"""Handle slots endpoints: show the pay table and spin the slot machine with karma.

Edit this file when the slots endpoints, stake limits, or spin logging change.
Copy the route pattern here when you add another small karma game endpoint.
"""

from __future__ import annotations

import logging
import random

from aiohttp import web

from backend.auth.access import require_active_user, require_user
from backend.config import Settings
from backend.db.karma import change_karma, get_karma
from backend.db.slots import insert_slot_spin
from backend.games.slots import pay_table_json, spin
from backend.http.fields import read_int
from backend.http.json_api import AppError, ok, read_json
from backend.http.middleware import require_allowed_origin

LOGGER = logging.getLogger("backend.slots")
RNG = random.SystemRandom()
MAX_STAKE = 1_000_000


async def slots_info(request: web.Request) -> web.Response:
    require_user(request)
    settings: Settings = request.app["settings"]
    return ok({"pay_table": pay_table_json(), "karma_floor": settings.karma_floor})


async def slots_spin(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    user = await require_active_user(request)
    payload = await read_json(request)
    stake = read_int(payload, "stake", label="Stake", minimum=1, maximum=MAX_STAKE)
    settings: Settings = request.app["settings"]
    db = request.app["db"]
    async with request.app["karma_lock"]:
        karma = await get_karma(db, user["id"]) or 0
        if karma - stake < settings.karma_floor:
            LOGGER.info("Spin rejected by karma floor user=%s karma=%s stake=%s", user["id"], karma, stake)
            raise AppError(400, "not_enough_karma", f"Not enough karma. Your karma can't go below {settings.karma_floor}.")
        reels, line = spin(RNG)
        multiplier = line.multiplier if line else 0
        payout = stake * multiplier
        try:
            spin_id = await insert_slot_spin(db, user["id"], stake, reels, multiplier, payout)
            karma_after = await change_karma(db, user["id"], -stake, "slots_stake", spin_id, risky=True, commit=False)
            if payout > 0:
                karma_after = await change_karma(db, user["id"], payout, "slots_payout", spin_id, risky=True, commit=False)
            await db.commit()
        except Exception:
            await db.rollback()
            raise
    LOGGER.info(
        "Slot spin spin=%s user=%s stake=%s reels=%s win=%s payout=%s karma_after=%s",
        spin_id,
        user["id"],
        stake,
        "".join(reels),
        line.name if line else None,
        payout,
        karma_after,
    )
    await request.app["ws_hub"].send_to_user(user["id"], {"type": "karma.changed", "karma": karma_after})
    return ok({"reels": reels, "win": line.name if line else None, "multiplier": multiplier, "payout": payout, "karma": karma_after})


def setup_slot_routes(app: web.Application) -> None:
    app.router.add_post("/api/slots/info", slots_info)
    app.router.add_post("/api/slots/spin", slots_spin)
