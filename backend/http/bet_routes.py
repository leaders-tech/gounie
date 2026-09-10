"""Handle EPS-bet endpoints: list and create bets, place wagers, reveal outcomes, and comments.

Edit this file when bet endpoints, bet input rules, or bet comments change.
Copy the route pattern here when you add another endpoint group with its own discussion thread.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from aiohttp import web

from backend.auth.access import require_active_user, require_user
from backend.db.bets import create_bet, create_comment, get_bet, list_bets, list_comments, list_wagers
from backend.db.connection import utc_now, utc_now_text
from backend.games.betting import deadline_passed, place_wager, settle_bet
from backend.http.fields import read_choice, read_id, read_int, read_text
from backend.http.json_api import AppError, ok, read_json
from backend.http.middleware import require_allowed_origin

LOGGER = logging.getLogger("backend.bets")
SIDES = {"yes", "no"}
MAX_WAGER = 1_000_000


def parse_deadline(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        raise AppError(400, "bad_request", "Deadline is required.")
    try:
        parsed = datetime.fromisoformat(value.strip())
    except ValueError as error:
        raise AppError(400, "bad_request", "Deadline must be a valid date and time.") from error
    if parsed.tzinfo is None:
        raise AppError(400, "bad_request", "Deadline must include a timezone.")
    parsed = parsed.astimezone(UTC)
    now = utc_now()
    if parsed <= now + timedelta(minutes=1):
        raise AppError(400, "bad_request", "Deadline must be in the future.")
    if parsed > now + timedelta(days=366):
        raise AppError(400, "bad_request", "Deadline must be within one year.")
    return parsed.isoformat(timespec="seconds")


async def load_bet(request: web.Request, bet_id: int) -> dict:
    bet = await get_bet(request.app["db"], bet_id)
    if bet is None:
        raise AppError(404, "not_found", "This bet does not exist.")
    return bet


async def bets_list(request: web.Request) -> web.Response:
    require_user(request)
    return ok({"bets": await list_bets(request.app["db"]), "server_now": utc_now_text()})


async def bets_get(request: web.Request) -> web.Response:
    require_user(request)
    payload = await read_json(request)
    bet = await load_bet(request, read_id(payload))
    db = request.app["db"]
    return ok(
        {
            "bet": bet,
            "wagers": await list_wagers(db, bet["id"]),
            "comments": await list_comments(db, bet["id"]),
            "server_now": utc_now_text(),
        }
    )


async def bets_create(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    user = await require_active_user(request)
    payload = await read_json(request)
    title = read_text(payload, "title", label="Title", min_length=3, max_length=140)
    description = read_text(payload, "description", label="Description", max_length=2000)
    deadline_at = parse_deadline(payload.get("deadline_at"))
    bet = await create_bet(request.app["db"], user["id"], title, description, deadline_at)
    LOGGER.info("Bet created bet=%s creator=%s deadline=%s title=%r", bet["id"], user["id"], deadline_at, title)
    await request.app["ws_hub"].broadcast({"type": "bet.changed", "bet_id": bet["id"]})
    return ok({"bet": bet})


async def bets_wager(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    user = await require_active_user(request)
    payload = await read_json(request)
    bet_id = read_id(payload, "bet_id")
    side = read_choice(payload, "side", label="Side", choices=SIDES)
    amount = read_int(payload, "amount", label="Amount", minimum=1, maximum=MAX_WAGER)
    result = await place_wager(request.app, bet_id, user["id"], side, amount)
    return ok(result)


async def bets_resolve(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    user = await require_active_user(request)
    payload = await read_json(request)
    bet = await load_bet(request, read_id(payload, "bet_id"))
    outcome = read_choice(payload, "outcome", label="Outcome", choices=SIDES)
    if bet["creator_id"] != user["id"]:
        LOGGER.info("Bet reveal rejected (not creator) bet=%s user=%s", bet["id"], user["id"])
        raise AppError(403, "not_allowed", "Only the creator of this bet can reveal the outcome.")
    if bet["status"] != "open":
        raise AppError(400, "bet_closed", "This bet is already closed.")
    if not deadline_passed(bet):
        raise AppError(400, "too_early", "You can reveal the outcome only after the deadline.")
    result = await settle_bet(request.app, bet["id"], "resolved", outcome, user["id"])
    if result is None:
        raise AppError(400, "bet_closed", "This bet is already closed.")
    return ok(result)


async def bets_comment(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    user = await require_active_user(request)
    payload = await read_json(request)
    bet = await load_bet(request, read_id(payload, "bet_id"))
    text = read_text(payload, "text", label="Comment", min_length=1, max_length=1000)
    comment = await create_comment(request.app["db"], bet["id"], user["id"], text)
    LOGGER.info("Bet comment posted comment=%s bet=%s author=%s", comment.get("id"), bet["id"], user["id"])
    await request.app["ws_hub"].broadcast({"type": "bet.comment", "bet_id": bet["id"]})
    return ok({"comment": comment})


def setup_bet_routes(app: web.Application) -> None:
    app.router.add_post("/api/bets/list", bets_list)
    app.router.add_post("/api/bets/get", bets_get)
    app.router.add_post("/api/bets/create", bets_create)
    app.router.add_post("/api/bets/wager", bets_wager)
    app.router.add_post("/api/bets/resolve", bets_resolve)
    app.router.add_post("/api/bets/comment", bets_comment)
