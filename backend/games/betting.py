"""Place EPS-bet wagers and close bets (reveal, cancel, refund) while keeping karma consistent.

Edit this file when wager rules, payouts, refunds, or bet closing rules change.
Do not copy this file. Change it when the betting rules change.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from aiohttp import web

from backend.config import Settings
from backend.db.bets import close_bet, get_bet, get_wager, insert_wager, list_wagers, set_wager_payout
from backend.db.connection import parse_utc_text, utc_now
from backend.db.karma import change_karma, get_karma, touch_karma_risk
from backend.http.json_api import AppError

LOGGER = logging.getLogger("backend.bets")


def deadline_passed(bet: dict[str, Any], now: datetime | None = None) -> bool:
    return parse_utc_text(bet["deadline_at"]) <= (now or utc_now())


async def place_wager(app: web.Application, bet_id: int, user_id: int, side: str, amount: int) -> dict[str, int]:
    db = app["db"]
    settings: Settings = app["settings"]
    async with app["karma_lock"]:
        bet = await get_bet(db, bet_id)
        if bet is None:
            raise AppError(404, "not_found", "This bet does not exist.")
        if bet["approval"] != "approved":
            raise AppError(403, "not_approved", "This bet is not live: the admin has not approved it.")
        if bet["status"] != "open":
            raise AppError(400, "bet_closed", "This bet is already closed.")
        if deadline_passed(bet):
            raise AppError(400, "deadline_passed", "Betting time for this bet is over.")
        if await get_wager(db, bet_id, user_id) is not None:
            raise AppError(409, "already_wagered", "You already placed a wager on this bet.")
        karma = await get_karma(db, user_id) or 0
        if karma - amount < settings.karma_floor:
            LOGGER.info("Wager rejected by karma floor bet=%s user=%s karma=%s amount=%s", bet_id, user_id, karma, amount)
            raise AppError(400, "not_enough_karma", f"Not enough karma. Your karma can't go below {settings.karma_floor}.")
        try:
            wager_id = await insert_wager(db, bet_id, user_id, side, amount)
            karma_after = await change_karma(db, user_id, -amount, "bet_wager", bet_id, risky=True, commit=False)
            await db.commit()
        except Exception:
            await db.rollback()
            raise
    LOGGER.info("Wager placed bet=%s user=%s side=%s amount=%s karma_after=%s", bet_id, user_id, side, amount, karma_after)
    await app["ws_hub"].send_to_user(user_id, {"type": "karma.changed", "karma": karma_after})
    await app["ws_hub"].broadcast({"type": "bet.changed", "bet_id": bet_id})
    return {"wager_id": wager_id, "karma": karma_after}


async def settle_bet(app: web.Application, bet_id: int, status: str, outcome: str | None, actor_id: int | None) -> dict[str, Any] | None:
    """Close an open bet and pay out.

    status "resolved": wagers on the outcome side get 2x back, the others get nothing.
    status "cancelled" or "refunded": every wager gets its stake back.
    Returns None when the bet was not open.
    """
    db = app["db"]
    paid: dict[int, int] = {}
    async with app["karma_lock"]:
        try:
            if not await close_bet(db, bet_id, status, outcome, actor_id):
                return None
            wagers = await list_wagers(db, bet_id)
            for wager in wagers:
                if status == "resolved":
                    payout = wager["amount"] * 2 if wager["side"] == outcome else 0
                else:
                    payout = wager["amount"]
                await set_wager_payout(db, wager["id"], payout)
                if payout > 0:
                    paid[wager["user_id"]] = await change_karma(db, wager["user_id"], payout, f"bet_{status}", bet_id, risky=True, commit=False)
                else:
                    await touch_karma_risk(db, wager["user_id"], commit=False)
            await db.commit()
        except Exception:
            await db.rollback()
            raise
    LOGGER.info(
        "Bet closed bet=%s status=%s outcome=%s actor=%s wagers=%s paid_users=%s",
        bet_id,
        status,
        outcome,
        actor_id,
        len(wagers),
        len(paid),
    )
    for user_id, karma in paid.items():
        await app["ws_hub"].send_to_user(user_id, {"type": "karma.changed", "karma": karma})
    await app["ws_hub"].broadcast({"type": "bet.changed", "bet_id": bet_id})
    return {"bet_id": bet_id, "status": status, "outcome": outcome, "wagers": len(wagers)}
