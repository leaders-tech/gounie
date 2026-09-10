"""Test EPS-bet: creating bets, wagers, the karma floor, revealing outcomes, admin closing, and comments.

Edit this file when bet endpoints, wager rules, or payouts change.
Copy a test pattern here when you add tests for another karma-changing feature.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from backend.db.karma import get_karma
from backend.tests.conftest import ADMIN_PASSWORD, api, login_as


def future(hours: int = 2) -> str:
    return (datetime.now(tz=UTC) + timedelta(hours=hours)).isoformat()


async def make_bet(client, cookies, title: str = "Will it snow on Friday?") -> dict:
    status, payload = await api(client, "/api/bets/create", {"title": title, "description": "Only real snow counts.", "deadline_at": future()}, cookies)
    assert status == 200, payload
    return payload["data"]["bet"]


async def expire(db, bet_id: int, days: int = 0) -> None:
    past = (datetime.now(tz=UTC) - timedelta(days=days, minutes=5)).isoformat(timespec="seconds")
    await db.execute("UPDATE bets SET deadline_at = ? WHERE id = ?", (past, bet_id))
    await db.commit()


async def wager(client, cookies, bet_id: int, side: str, amount: int) -> tuple[int, dict]:
    return await api(client, "/api/bets/wager", {"bet_id": bet_id, "side": side, "amount": amount}, cookies)


@pytest.fixture
async def people(client, create_user):
    ids = {name: await create_user(name) for name in ("carol", "alice", "bob")}
    cookies = {name: await login_as(client, name) for name in ids}
    return ids, cookies


@pytest.mark.asyncio
async def test_create_and_list_bet(client, people) -> None:
    _, cookies = people
    bet = await make_bet(client, cookies["carol"])
    assert bet["status"] == "open"
    assert bet["creator_username"] == "carol"
    assert bet["deadline_at"].endswith("+00:00")

    status, payload = await api(client, "/api/bets/list", {}, cookies["alice"])
    assert status == 200
    assert [item["id"] for item in payload["data"]["bets"]] == [bet["id"]]


@pytest.mark.asyncio
@pytest.mark.parametrize("deadline", ["", "not a date", "2020-01-01T00:00:00+00:00", "2030-01-01T00:00:00", "2099-01-01T00:00:00+00:00", None])
async def test_create_bet_rejects_bad_deadline(client, people, deadline) -> None:
    _, cookies = people
    status, _ = await api(client, "/api/bets/create", {"title": "Title", "deadline_at": deadline}, cookies["carol"])
    assert status == 400


@pytest.mark.asyncio
async def test_create_bet_requires_title(client, people) -> None:
    _, cookies = people
    status, _ = await api(client, "/api/bets/create", {"title": "no", "deadline_at": future()}, cookies["carol"])
    assert status == 400


@pytest.mark.asyncio
async def test_wager_deducts_karma_and_is_final(client, db, people) -> None:
    ids, cookies = people
    bet = await make_bet(client, cookies["carol"])

    status, payload = await wager(client, cookies["alice"], bet["id"], "yes", 10)
    assert status == 200
    assert payload["data"]["karma"] == -10
    assert await get_karma(db, ids["alice"]) == -10

    status, payload = await wager(client, cookies["alice"], bet["id"], "no", 5)
    assert status == 409

    _, payload = await api(client, "/api/bets/get", {"id": bet["id"]}, cookies["bob"])
    assert payload["data"]["bet"]["yes_total"] == 10
    assert [(item["username"], item["side"], item["amount"]) for item in payload["data"]["wagers"]] == [("alice", "yes", 10)]


@pytest.mark.asyncio
async def test_creator_cannot_wager(client, people) -> None:
    _, cookies = people
    bet = await make_bet(client, cookies["carol"])
    status, payload = await wager(client, cookies["carol"], bet["id"], "yes", 1)
    assert status == 403
    assert payload["error"]["code"] == "own_bet"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "body", [{"side": "maybe", "amount": 5}, {"side": "yes", "amount": 0}, {"side": "yes", "amount": "5"}, {"side": "yes", "amount": True}]
)
async def test_wager_input_validation(client, people, body) -> None:
    _, cookies = people
    bet = await make_bet(client, cookies["carol"])
    status, _ = await api(client, "/api/bets/wager", {"bet_id": bet["id"], **body}, cookies["alice"])
    assert status == 400


@pytest.mark.asyncio
async def test_wager_respects_karma_floor(client, db, people) -> None:
    ids, cookies = people
    first = await make_bet(client, cookies["carol"], "First bet")
    second = await make_bet(client, cookies["carol"], "Second bet")

    status, payload = await wager(client, cookies["alice"], first["id"], "yes", 51)
    assert status == 400
    assert payload["error"]["code"] == "not_enough_karma"
    assert (await wager(client, cookies["alice"], first["id"], "yes", 50))[0] == 200
    assert (await wager(client, cookies["alice"], second["id"], "yes", 1))[0] == 400
    assert await get_karma(db, ids["alice"]) == -50


@pytest.mark.asyncio
async def test_wager_after_deadline_is_rejected(client, db, people) -> None:
    _, cookies = people
    bet = await make_bet(client, cookies["carol"])
    await expire(db, bet["id"])
    status, payload = await wager(client, cookies["alice"], bet["id"], "yes", 1)
    assert status == 400
    assert payload["error"]["code"] == "deadline_passed"


@pytest.mark.asyncio
async def test_reveal_rules_and_payouts(client, db, people) -> None:
    ids, cookies = people
    bet = await make_bet(client, cookies["carol"])
    await wager(client, cookies["alice"], bet["id"], "yes", 10)
    await wager(client, cookies["bob"], bet["id"], "no", 5)

    assert (await api(client, "/api/bets/resolve", {"bet_id": bet["id"], "outcome": "yes"}, cookies["bob"]))[0] == 403
    status, payload = await api(client, "/api/bets/resolve", {"bet_id": bet["id"], "outcome": "yes"}, cookies["carol"])
    assert status == 400
    assert payload["error"]["code"] == "too_early"

    await expire(db, bet["id"])
    assert (await api(client, "/api/bets/resolve", {"bet_id": bet["id"], "outcome": "maybe"}, cookies["carol"]))[0] == 400
    status, _ = await api(client, "/api/bets/resolve", {"bet_id": bet["id"], "outcome": "yes"}, cookies["carol"])
    assert status == 200

    assert await get_karma(db, ids["alice"]) == 10
    assert await get_karma(db, ids["bob"]) == -5
    assert await get_karma(db, ids["carol"]) == 0
    assert (await api(client, "/api/bets/resolve", {"bet_id": bet["id"], "outcome": "no"}, cookies["carol"]))[0] == 400

    _, payload = await api(client, "/api/bets/get", {"id": bet["id"]}, cookies["alice"])
    assert payload["data"]["bet"]["status"] == "resolved"
    assert payload["data"]["bet"]["outcome"] == "yes"
    assert [item["payout"] for item in payload["data"]["wagers"]] == [20, 0]


@pytest.mark.asyncio
async def test_admin_can_cancel_with_refund_and_resolve_any_time(client, db, people) -> None:
    ids, cookies = people
    admin = await login_as(client, "admin", ADMIN_PASSWORD)
    first = await make_bet(client, cookies["carol"], "First bet")
    second = await make_bet(client, cookies["carol"], "Second bet")
    await wager(client, cookies["alice"], first["id"], "yes", 10)
    await wager(client, cookies["bob"], second["id"], "no", 7)

    assert (await api(client, "/api/admin/bets/cancel", {"bet_id": first["id"]}, cookies["alice"]))[0] == 403
    status, payload = await api(client, "/api/admin/bets/cancel", {"bet_id": first["id"]}, admin)
    assert status == 200
    assert payload["data"]["status"] == "cancelled"
    assert await get_karma(db, ids["alice"]) == 0
    assert (await api(client, "/api/admin/bets/cancel", {"bet_id": first["id"]}, admin))[0] == 400

    status, _ = await api(client, "/api/admin/bets/resolve", {"bet_id": second["id"], "outcome": "no"}, admin)
    assert status == 200
    assert await get_karma(db, ids["bob"]) == 7
    assert (await api(client, "/api/admin/bets/cancel", {"bet_id": 9999}, admin))[0] == 404


@pytest.mark.asyncio
async def test_comments_and_admin_delete(client, people) -> None:
    _, cookies = people
    admin = await login_as(client, "admin", ADMIN_PASSWORD)
    bet = await make_bet(client, cookies["carol"])

    status, payload = await api(client, "/api/bets/comment", {"bet_id": bet["id"], "text": "I think yes"}, cookies["alice"])
    assert status == 200
    comment_id = payload["data"]["comment"]["id"]
    assert payload["data"]["comment"]["author_username"] == "alice"
    assert (await api(client, "/api/bets/comment", {"bet_id": bet["id"], "text": "  "}, cookies["alice"]))[0] == 400
    assert (await api(client, "/api/bets/comment", {"bet_id": bet["id"], "text": "x" * 1001}, cookies["alice"]))[0] == 400
    assert (await api(client, "/api/bets/comment", {"bet_id": 9999, "text": "hi"}, cookies["alice"]))[0] == 404

    _, payload = await api(client, "/api/bets/get", {"id": bet["id"]}, cookies["bob"])
    assert [item["text"] for item in payload["data"]["comments"]] == ["I think yes"]
    assert payload["data"]["bet"]["comment_count"] == 1

    assert (await api(client, "/api/admin/comments/delete", {"id": comment_id}, admin))[0] == 200
    assert (await api(client, "/api/admin/comments/delete", {"id": comment_id}, admin))[0] == 404
    _, payload = await api(client, "/api/bets/get", {"id": bet["id"]}, cookies["bob"])
    assert payload["data"]["comments"] == []


@pytest.mark.asyncio
async def test_unknown_bet_returns_404(client, people) -> None:
    _, cookies = people
    assert (await api(client, "/api/bets/get", {"id": 9999}, cookies["alice"]))[0] == 404
    assert (await wager(client, cookies["alice"], 9999, "yes", 1))[0] == 404
