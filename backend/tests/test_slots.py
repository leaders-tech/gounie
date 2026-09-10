"""Test slots: the 10% payback pay table, reels matching results, stakes, the karma floor, and logging.

Edit this file when slot payouts, stake rules, or the spin endpoint change.
Copy a test pattern here when you add tests for another random game.
"""

from __future__ import annotations

import logging
import random

import pytest

from backend.db.karma import get_karma
from backend.games.slots import DIAMOND, PAY_TABLE, TOTAL_WEIGHT, evaluate_reels, expected_payback, spin
from backend.tests.conftest import api, login_as

LOSING_REELS = ["🍋", "🔔", "⭐"]


def test_expected_payback_is_at_most_ten_percent() -> None:
    assert expected_payback() == pytest.approx(0.10)
    assert expected_payback() <= 0.10
    assert sum(line.weight for line in PAY_TABLE) < TOTAL_WEIGHT


def test_spin_reels_always_match_the_result() -> None:
    rng = random.Random(7)
    for _ in range(20_000):
        reels, line = spin(rng)
        assert len(reels) == 3
        assert evaluate_reels(reels) == (line.multiplier if line else 0)


def test_long_run_payback_stays_low() -> None:
    rng = random.Random(123)
    spins = 100_000
    returned = sum((line.multiplier if line else 0) for _, line in (spin(rng) for _ in range(spins)))
    assert returned / spins < 0.13


@pytest.mark.asyncio
async def test_winning_spin_pays_stake_times_multiplier(client, db, create_user, monkeypatch, caplog) -> None:
    user_id = await create_user("alice")
    cookies = await login_as(client, "alice")
    monkeypatch.setattr("backend.http.slot_routes.spin", lambda _rng: ([DIAMOND] * 3, PAY_TABLE[0]))

    with caplog.at_level(logging.INFO, logger="backend.slots"):
        status, payload = await api(client, "/api/slots/spin", {"stake": 2}, cookies)
    assert status == 200
    assert payload["data"] == {"reels": [DIAMOND] * 3, "win": "diamonds", "multiplier": 50, "payout": 100, "karma": 98}
    assert await get_karma(db, user_id) == 98
    assert "Slot spin" in caplog.text

    cursor = await db.execute("SELECT reason, delta FROM karma_changes WHERE user_id = ? ORDER BY id", (user_id,))
    assert [(row["reason"], row["delta"]) for row in await cursor.fetchall()] == [("slots_stake", -2), ("slots_payout", 100)]
    cursor = await db.execute("SELECT COUNT(*) AS count FROM slot_spins")
    assert (await cursor.fetchone())["count"] == 1


@pytest.mark.asyncio
async def test_losing_spins_stop_at_karma_floor(client, db, create_user, monkeypatch) -> None:
    user_id = await create_user("alice")
    cookies = await login_as(client, "alice")
    monkeypatch.setattr("backend.http.slot_routes.spin", lambda _rng: (LOSING_REELS, None))

    status, payload = await api(client, "/api/slots/spin", {"stake": 50}, cookies)
    assert status == 200
    assert payload["data"]["payout"] == 0
    status, payload = await api(client, "/api/slots/spin", {"stake": 1}, cookies)
    assert status == 400
    assert payload["error"]["code"] == "not_enough_karma"
    assert await get_karma(db, user_id) == -50


@pytest.mark.asyncio
@pytest.mark.parametrize("stake", [0, -1, "5", 1.5, True, None])
async def test_bad_stakes_are_rejected(client, create_user, stake) -> None:
    await create_user("alice")
    cookies = await login_as(client, "alice")
    status, _ = await api(client, "/api/slots/spin", {"stake": stake}, cookies)
    assert status == 400


@pytest.mark.asyncio
async def test_slots_info(client, create_user) -> None:
    await create_user("alice")
    cookies = await login_as(client, "alice")
    status, payload = await api(client, "/api/slots/info", {}, cookies)
    assert status == 200
    assert "payback" not in payload["data"]
    assert all("chance" not in line for line in payload["data"]["pay_table"])
    assert payload["data"]["karma_floor"] == -50
    assert [line["multiplier"] for line in payload["data"]["pay_table"]] == [50, 20, 5, 1]


@pytest.mark.asyncio
async def test_spin_requires_login(client) -> None:
    status, _ = await api(client, "/api/slots/spin", {"stake": 1})
    assert status == 401
