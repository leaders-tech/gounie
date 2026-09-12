"""Test that new bets wait for the admin: who may see them, who may act on them, and the decision emails.

Edit this file when the bet approval rules or the approved/declined emails change.
Copy a test pattern here when you add another flow where an admin releases user content.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from backend.jobs import refund_abandoned_bets
from backend.mail.notifications import bet_decision_email
from backend.tests.conftest import ADMIN_PASSWORD, api, login_as


def future(hours: int = 2) -> str:
    return (datetime.now(tz=UTC) + timedelta(hours=hours)).isoformat()


async def propose(client, cookies, title: str = "Will the bus be late?") -> dict:
    status, payload = await api(client, "/api/bets/create", {"title": title, "description": "Any delay counts.", "deadline_at": future()}, cookies)
    assert status == 200, payload
    return payload["data"]["bet"]


def outbox_for(client, email: str) -> list[dict[str, str]]:
    return [message for message in client.app["email_outbox"] if message["to"] == email]


@pytest.fixture
async def people(client, create_user):
    ids = {name: await create_user(name) for name in ("carol", "alice")}
    cookies = {name: await login_as(client, name) for name in ids}
    cookies["admin"] = await login_as(client, "admin", ADMIN_PASSWORD)
    return ids, cookies


@pytest.mark.asyncio
async def test_new_bet_waits_for_the_admin(client, people) -> None:
    _, cookies = people
    bet = await propose(client, cookies["carol"])
    assert bet["approval"] == "pending"

    # Only the creator and the admin know it exists.
    _, mine = await api(client, "/api/bets/list", {}, cookies["carol"])
    assert [item["id"] for item in mine["data"]["bets"]] == [bet["id"]]
    _, others = await api(client, "/api/bets/list", {}, cookies["alice"])
    assert others["data"]["bets"] == []
    _, visitors = await api(client, "/api/bets/list", {})
    assert visitors["data"]["bets"] == []
    _, admin_list = await api(client, "/api/bets/list", {}, cookies["admin"])
    assert [item["id"] for item in admin_list["data"]["bets"]] == [bet["id"]]

    assert (await api(client, "/api/bets/get", {"id": bet["id"]}, cookies["alice"]))[0] == 404
    assert (await api(client, "/api/bets/get", {"id": bet["id"]}, cookies["carol"]))[0] == 200
    assert (await api(client, "/api/bets/get", {"id": bet["id"]}, cookies["admin"]))[0] == 200


@pytest.mark.asyncio
async def test_nobody_can_act_on_a_waiting_bet(client, people) -> None:
    _, cookies = people
    bet = await propose(client, cookies["carol"])

    # A waiting bet is invisible to everybody but the creator and the admin.
    assert (await api(client, "/api/bets/wager", {"bet_id": bet["id"], "side": "yes", "amount": 5}, cookies["alice"]))[0] == 404
    status, payload = await api(client, "/api/bets/wager", {"bet_id": bet["id"], "side": "yes", "amount": 5}, cookies["carol"])
    assert status == 403
    assert payload["error"]["code"] == "not_approved"
    status, payload = await api(client, "/api/bets/comment", {"bet_id": bet["id"], "text": "nice one"}, cookies["carol"])
    assert status == 403
    assert payload["error"]["code"] == "not_approved"
    status, payload = await api(client, "/api/bets/resolve", {"bet_id": bet["id"], "outcome": "yes"}, cookies["carol"])
    assert status == 403
    assert payload["error"]["code"] == "not_approved"
    status, payload = await api(client, "/api/admin/bets/cancel", {"bet_id": bet["id"]}, cookies["admin"])
    assert status == 400
    assert payload["error"]["code"] == "not_approved"


@pytest.mark.asyncio
async def test_admin_approves_a_bet_and_the_creator_gets_an_email(client, people) -> None:
    ids, cookies = people
    bet = await propose(client, cookies["carol"])

    status, payload = await api(client, "/api/admin/bets/pending", {}, cookies["admin"])
    assert status == 200
    assert [item["id"] for item in payload["data"]["bets"]] == [bet["id"]]

    status, payload = await api(client, "/api/admin/bets/approve", {"bet_id": bet["id"], "note": "Good question!"}, cookies["admin"])
    assert status == 200
    assert payload["data"] == {"bet_id": bet["id"], "approval": "approved", "email_sent": True}

    _, payload = await api(client, "/api/bets/get", {"id": bet["id"]}, cookies["alice"])
    assert payload["data"]["bet"]["approval"] == "approved"
    assert payload["data"]["bet"]["review_note"] == "Good question!"
    assert (await api(client, "/api/bets/wager", {"bet_id": bet["id"], "side": "yes", "amount": 5}, cookies["alice"]))[0] == 200
    assert (await api(client, "/api/admin/bets/pending", {}, cookies["admin"]))[1]["data"]["bets"] == []

    messages = outbox_for(client, "carol@example.edu")
    assert len(messages) == 1
    assert "Your bet is live" in messages[0]["subject"]
    assert f"/eps-bet/{bet['id']}" in messages[0]["body"]
    assert "Good question!" in messages[0]["body"]


@pytest.mark.asyncio
async def test_admin_declines_a_bet_and_it_stays_hidden(client, people) -> None:
    _, cookies = people
    bet = await propose(client, cookies["carol"])

    status, payload = await api(client, "/api/admin/bets/decline", {"bet_id": bet["id"], "note": "Too personal."}, cookies["admin"])
    assert status == 200
    assert payload["data"]["approval"] == "declined"

    assert (await api(client, "/api/bets/get", {"id": bet["id"]}, cookies["alice"]))[0] == 404
    _, payload = await api(client, "/api/bets/get", {"id": bet["id"]}, cookies["carol"])
    assert payload["data"]["bet"]["approval"] == "declined"
    assert payload["data"]["bet"]["review_note"] == "Too personal."
    assert (await api(client, "/api/bets/comment", {"bet_id": bet["id"], "text": "why?"}, cookies["carol"]))[0] == 403

    messages = outbox_for(client, "carol@example.edu")
    assert len(messages) == 1
    assert "not approved" in messages[0]["subject"]
    assert "Too personal." in messages[0]["body"]


@pytest.mark.asyncio
async def test_only_the_admin_reviews_and_only_once(client, people) -> None:
    _, cookies = people
    bet = await propose(client, cookies["carol"])

    assert (await api(client, "/api/admin/bets/pending", {}, cookies["carol"]))[0] == 403
    assert (await api(client, "/api/admin/bets/approve", {"bet_id": bet["id"]}, cookies["carol"]))[0] == 403
    assert (await api(client, "/api/admin/bets/approve", {"bet_id": bet["id"]}, None))[0] == 401
    assert (await api(client, "/api/admin/bets/approve", {"bet_id": 9999}, cookies["admin"]))[0] == 404
    assert (await api(client, "/api/admin/bets/approve", {"bet_id": bet["id"], "note": "x" * 501}, cookies["admin"]))[0] == 400

    assert (await api(client, "/api/admin/bets/approve", {"bet_id": bet["id"]}, cookies["admin"]))[0] == 200
    status, payload = await api(client, "/api/admin/bets/decline", {"bet_id": bet["id"]}, cookies["admin"])
    assert status == 400
    assert payload["error"]["code"] == "already_reviewed"
    assert len(outbox_for(client, "carol@example.edu")) == 1


@pytest.mark.asyncio
async def test_waiting_bets_are_never_refunded_as_abandoned(client, db, people) -> None:
    _, cookies = people
    bet = await propose(client, cookies["carol"])
    long_ago = (datetime.now(tz=UTC) - timedelta(days=30)).isoformat(timespec="seconds")
    await db.execute("UPDATE bets SET deadline_at = ? WHERE id = ?", (long_ago, bet["id"]))
    await db.commit()

    assert await refund_abandoned_bets(client.app) == []


def test_decision_email_texts(test_settings) -> None:
    bet = {"id": 7, "title": "Will it snow?"}
    subject, body = bet_decision_email(test_settings, bet, "carol", True, "")
    assert subject == "Your bet is live: Will it snow?"
    assert f"{test_settings.frontend_origin}/eps-bet/7" in body

    subject, body = bet_decision_email(test_settings, bet, "carol", False, "Not a real question.")
    assert subject == "Your bet was not approved: Will it snow?"
    assert "Not a real question." in body
    assert "/eps-bet/7" not in body
