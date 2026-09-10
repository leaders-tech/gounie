"""Run small background jobs: refund abandoned bets and reset negative karma to 0 after 24 quiet hours.

Edit this file when background job timing or the refund/recovery rules change.
Copy the job function style here when you add another periodic backend job.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from datetime import datetime, timedelta

from aiohttp import web

from backend.db.bets import list_abandoned_bet_ids
from backend.db.connection import utc_now
from backend.db.karma import change_karma, list_recoverable_users
from backend.games.betting import settle_bet

LOGGER = logging.getLogger("backend.jobs")
ABANDONED_BET_AFTER = timedelta(days=7)
RECOVERY_AFTER = timedelta(hours=24)
JOB_INTERVAL_SECONDS = 300


async def refund_abandoned_bets(app: web.Application, now: datetime | None = None) -> list[int]:
    """Refund every open bet whose creator did not reveal the outcome within 7 days after the deadline."""
    cutoff = ((now or utc_now()) - ABANDONED_BET_AFTER).isoformat(timespec="seconds")
    refunded = []
    for bet_id in await list_abandoned_bet_ids(app["db"], cutoff):
        if await settle_bet(app, bet_id, "refunded", None, None) is not None:
            LOGGER.info("Abandoned bet refunded bet=%s", bet_id)
            refunded.append(bet_id)
    return refunded


async def recover_negative_karma(app: web.Application, now: datetime | None = None) -> list[int]:
    """Set karma to 0 for users with negative karma, no open wagers, and no gambling for 24 hours."""
    db = app["db"]
    cutoff = ((now or utc_now()) - RECOVERY_AFTER).isoformat(timespec="seconds")
    recovered = []
    async with app["karma_lock"]:
        for row in await list_recoverable_users(db, cutoff):
            await change_karma(db, row["id"], -row["karma"], "recovery", commit=False)
            recovered.append(row["id"])
            LOGGER.info("Karma recovered to 0 user=%s nickname=%s old_karma=%s", row["id"], row["username"], row["karma"])
        await db.commit()
    for user_id in recovered:
        await app["ws_hub"].send_to_user(user_id, {"type": "karma.changed", "karma": 0})
    return recovered


async def run_jobs_once(app: web.Application, now: datetime | None = None) -> None:
    await refund_abandoned_bets(app, now)
    await recover_negative_karma(app, now)


async def _jobs_loop(app: web.Application) -> None:
    while True:
        try:
            await run_jobs_once(app)
        except Exception:
            LOGGER.exception("Background jobs failed.")
        await asyncio.sleep(JOB_INTERVAL_SECONDS)


def start_jobs(app: web.Application) -> None:
    LOGGER.info("Starting background jobs every %s seconds.", JOB_INTERVAL_SECONDS)
    app["jobs_task"] = asyncio.create_task(_jobs_loop(app))


async def stop_jobs(app: web.Application) -> None:
    task = app.get("jobs_task")
    if task is None:
        return
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task
    LOGGER.info("Background jobs stopped.")
