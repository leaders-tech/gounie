"""Test background jobs: 24h karma recovery rules and refunds for abandoned bets.

Edit this file when recovery timing, the recovery rules, or abandoned-bet refunds change.
Copy a test pattern here when you add tests for another background job.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from backend.db.bets import get_bet
from backend.db.karma import change_karma, get_karma
from backend.games.betting import settle_bet
from backend.jobs import recover_negative_karma, refund_abandoned_bets
from backend.tests.conftest import api, login_as


def hours_ago(hours: float) -> str:
    return (datetime.now(tz=UTC) - timedelta(hours=hours)).isoformat(timespec="seconds")


async def set_karma(db, user_id: int, karma: int, risk_hours_ago: float | None) -> None:
    risk = None if risk_hours_ago is None else hours_ago(risk_hours_ago)
    await db.execute("UPDATE users SET karma = ?, karma_risk_at = ? WHERE id = ?", (karma, risk, user_id))
    await db.commit()


async def set_risk_hours_ago(db, user_id: int, hours: float) -> None:
    await db.execute("UPDATE users SET karma_risk_at = ? WHERE id = ?", (hours_ago(hours), user_id))
    await db.commit()


async def make_bet(client, cookies, days_from_now: float = 0.1) -> int:
    deadline = (datetime.now(tz=UTC) + timedelta(days=days_from_now)).isoformat()
    status, payload = await api(client, "/api/bets/create", {"title": "Will it rain?", "deadline_at": deadline}, cookies)
    assert status == 200, payload
    return payload["data"]["bet"]["id"]


@pytest.mark.asyncio
async def test_negative_karma_recovers_after_24_quiet_hours(client, db, create_user) -> None:
    alice = await create_user("alice")
    bob = await create_user("bob")
    carol = await create_user("carol")
    await set_karma(db, alice, -30, 25)
    await set_karma(db, bob, -10, 2)
    await set_karma(db, carol, 5, 30)

    assert await recover_negative_karma(client.app) == [alice]
    assert await get_karma(db, alice) == 0
    assert await get_karma(db, bob) == -10
    assert await get_karma(db, carol) == 5

    cursor = await db.execute("SELECT reason, delta FROM karma_changes WHERE user_id = ?", (alice,))
    assert [(row["reason"], row["delta"]) for row in await cursor.fetchall()] == [("recovery", 30)]


@pytest.mark.asyncio
async def test_open_wager_blocks_recovery_and_closing_restarts_timer(client, db, create_user) -> None:
    await create_user("carol")
    alice = await create_user("alice")
    carol_cookies = await login_as(client, "carol")
    alice_cookies = await login_as(client, "alice")
    bet_id = await make_bet(client, carol_cookies)
    assert (await api(client, "/api/bets/wager", {"bet_id": bet_id, "side": "yes", "amount": 10}, alice_cookies))[0] == 200

    await set_risk_hours_ago(db, alice, 25)
    assert await recover_negative_karma(client.app) == []

    await settle_bet(client.app, bet_id, "resolved", "no", None)
    assert await get_karma(db, alice) == -10
    assert await recover_negative_karma(client.app) == []

    await set_risk_hours_ago(db, alice, 25)
    assert await recover_negative_karma(client.app) == [alice]


@pytest.mark.asyncio
async def test_slot_spin_restarts_recovery_timer(client, db, create_user, monkeypatch) -> None:
    alice = await create_user("alice")
    cookies = await login_as(client, "alice")
    await set_karma(db, alice, -10, 25)
    monkeypatch.setattr("backend.http.slot_routes.spin", lambda _rng: (["🍋", "🔔", "⭐"], None))

    assert (await api(client, "/api/slots/spin", {"stake": 1}, cookies))[0] == 200
    assert await recover_negative_karma(client.app) == []
    assert await get_karma(db, alice) == -11


@pytest.mark.asyncio
async def test_going_negative_starts_timer_but_more_losses_do_not(client, db, create_user) -> None:
    alice = await create_user("alice", karma=5)
    await change_karma(db, alice, -10, "test")
    cursor = await db.execute("SELECT karma_risk_at FROM users WHERE id = ?", (alice,))
    assert (await cursor.fetchone())["karma_risk_at"] is not None

    old = hours_ago(30)
    await db.execute("UPDATE users SET karma_risk_at = ? WHERE id = ?", (old, alice))
    await db.commit()
    await change_karma(db, alice, -3, "link_vote")
    cursor = await db.execute("SELECT karma_risk_at FROM users WHERE id = ?", (alice,))
    assert (await cursor.fetchone())["karma_risk_at"] == old


@pytest.mark.asyncio
async def test_abandoned_bets_are_refunded_after_7_days(client, db, create_user) -> None:
    await create_user("carol")
    alice = await create_user("alice")
    carol_cookies = await login_as(client, "carol")
    alice_cookies = await login_as(client, "alice")
    old_bet = await make_bet(client, carol_cookies)
    newer_bet = await make_bet(client, carol_cookies)
    await api(client, "/api/bets/wager", {"bet_id": old_bet, "side": "yes", "amount": 10}, alice_cookies)
    await api(client, "/api/bets/wager", {"bet_id": newer_bet, "side": "no", "amount": 5}, alice_cookies)

    await db.execute("UPDATE bets SET deadline_at = ? WHERE id = ?", (hours_ago(24 * 8), old_bet))
    await db.execute("UPDATE bets SET deadline_at = ? WHERE id = ?", (hours_ago(24 * 6), newer_bet))
    await db.commit()

    assert await refund_abandoned_bets(client.app) == [old_bet]
    assert await get_karma(db, alice) == -5
    assert (await get_bet(db, old_bet))["status"] == "refunded"
    assert (await get_bet(db, newer_bet))["status"] == "open"
    assert await refund_abandoned_bets(client.app) == []
