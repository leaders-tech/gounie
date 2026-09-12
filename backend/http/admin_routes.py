"""Handle admin-only endpoints: users, karma, bans, real deletes, approving bets, and closing any bet.

Edit this file when admin powers or admin endpoint rules change.
Copy the route pattern here when you add another admin-only endpoint.
"""

from __future__ import annotations

import logging

from aiohttp import web

from backend.auth.access import require_admin
from backend.db.bets import delete_comment, get_bet, list_bets_by_approval, set_bet_approval
from backend.db.links import delete_link
from backend.db.refresh_sessions import delete_user_sessions
from backend.db.karma import change_karma, get_karma, list_karma_changes
from backend.db.users import get_user_by_id, list_users, set_user_banned
from backend.db.wall import delete_wall_note
from backend.games.betting import settle_bet
from backend.http.fields import read_choice, read_id, read_int, read_text
from backend.http.json_api import AppError, ok, read_json
from backend.http.middleware import require_allowed_origin
from backend.mail.notifications import send_bet_decision_email

LOGGER = logging.getLogger("backend.admin")


async def admin_users_list(request: web.Request) -> web.Response:
    require_admin(request)
    return ok({"users": await list_users(request.app["db"])})


async def admin_karma_history(request: web.Request) -> web.Response:
    require_admin(request)
    payload = await read_json(request)
    return ok({"changes": await list_karma_changes(request.app["db"], read_id(payload, "user_id"))})


async def admin_set_karma(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    admin = require_admin(request)
    payload = await read_json(request)
    user_id = read_id(payload, "user_id")
    new_karma = read_int(payload, "karma", label="Karma", minimum=-1_000_000, maximum=1_000_000)
    db = request.app["db"]
    async with request.app["karma_lock"]:
        old_karma = await get_karma(db, user_id)
        if old_karma is None:
            raise AppError(404, "not_found", "This user does not exist.")
        karma_after = await change_karma(db, user_id, new_karma - old_karma, "admin_set", admin["id"])
    LOGGER.info("Admin set karma admin=%s user=%s old_karma=%s new_karma=%s", admin["id"], user_id, old_karma, karma_after)
    await request.app["ws_hub"].send_to_user(user_id, {"type": "karma.changed", "karma": karma_after})
    return ok({"user_id": user_id, "karma": karma_after})


async def admin_ban(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    admin = require_admin(request)
    payload = await read_json(request)
    user_id = read_id(payload, "user_id")
    banned = payload.get("banned")
    if not isinstance(banned, bool):
        raise AppError(400, "bad_request", "banned must be true or false.")
    db = request.app["db"]
    row = await get_user_by_id(db, user_id)
    if row is None:
        raise AppError(404, "not_found", "This user does not exist.")
    if row["is_admin"]:
        raise AppError(400, "bad_request", "Admins can't be banned.")
    await set_user_banned(db, user_id, banned)
    if banned:
        await delete_user_sessions(db, user_id)
    LOGGER.info("Admin %s user admin=%s user=%s nickname=%s", "banned" if banned else "unbanned", admin["id"], user_id, row["username"])
    return ok({"user_id": user_id, "banned": banned})


async def admin_wall_delete(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    admin = require_admin(request)
    payload = await read_json(request)
    note = await delete_wall_note(request.app["db"], read_id(payload))
    if note is None:
        raise AppError(404, "not_found", "This note does not exist.")
    LOGGER.info("Admin deleted wall note admin=%s note=%s author=%s wall=%s", admin["id"], note["id"], note["author_id"], note["wall_user_id"])
    await request.app["ws_hub"].broadcast({"type": "wall.changed", "wall_user_id": note["wall_user_id"]})
    return ok({"deleted": True, "id": note["id"]})


async def admin_comment_delete(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    admin = require_admin(request)
    payload = await read_json(request)
    comment_id = read_id(payload)
    bet_id = await delete_comment(request.app["db"], comment_id)
    if bet_id is None:
        raise AppError(404, "not_found", "This comment does not exist.")
    LOGGER.info("Admin deleted bet comment admin=%s comment=%s bet=%s", admin["id"], comment_id, bet_id)
    await request.app["ws_hub"].broadcast({"type": "bet.comment", "bet_id": bet_id})
    return ok({"deleted": True, "id": comment_id})


async def admin_link_delete(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    admin = require_admin(request)
    payload = await read_json(request)
    link_id = read_id(payload)
    if not await delete_link(request.app["db"], link_id):
        raise AppError(404, "not_found", "This link does not exist.")
    LOGGER.info("Admin deleted link admin=%s link=%s", admin["id"], link_id)
    await request.app["ws_hub"].broadcast({"type": "links.changed"})
    return ok({"deleted": True, "id": link_id})


async def admin_bets_pending(request: web.Request) -> web.Response:
    """List the bets that users proposed and that nobody has approved or declined yet."""
    require_admin(request)
    return ok({"bets": await list_bets_by_approval(request.app["db"], "pending")})


async def _review_bet(request: web.Request, approval: str) -> web.Response:
    """Approve or decline a waiting bet and email the user who proposed it."""
    require_allowed_origin(request)
    admin = require_admin(request)
    payload = await read_json(request)
    bet_id = read_id(payload, "bet_id")
    note = read_text(payload, "note", label="Note", min_length=0, max_length=500)
    db = request.app["db"]
    bet = await get_bet(db, bet_id)
    if bet is None:
        raise AppError(404, "not_found", "This bet does not exist.")
    if bet["approval"] != "pending":
        raise AppError(400, "already_reviewed", "This bet was already approved or declined.")
    if not await set_bet_approval(db, bet_id, approval, admin["id"], note):
        raise AppError(400, "already_reviewed", "This bet was already approved or declined.")

    creator = await get_user_by_id(db, bet["creator_id"])
    sent = await send_bet_decision_email(
        request.app,
        bet,
        creator["email"] if creator is not None else None,
        creator["username"] if creator is not None else "",
        approval == "approved",
        note,
    )
    LOGGER.info("Admin %s bet admin=%s bet=%s creator=%s email_sent=%s", approval, admin["id"], bet_id, bet["creator_id"], sent)
    await request.app["ws_hub"].broadcast({"type": "bet.changed", "bet_id": bet_id})
    return ok({"bet_id": bet_id, "approval": approval, "email_sent": sent})


async def admin_bet_approve(request: web.Request) -> web.Response:
    return await _review_bet(request, "approved")


async def admin_bet_decline(request: web.Request) -> web.Response:
    return await _review_bet(request, "declined")


async def _close_bet_as_admin(request: web.Request, status: str) -> web.Response:
    require_allowed_origin(request)
    admin = require_admin(request)
    payload = await read_json(request)
    bet_id = read_id(payload, "bet_id")
    outcome = read_choice(payload, "outcome", label="Outcome", choices={"yes", "no"}) if status == "resolved" else None
    bet = await get_bet(request.app["db"], bet_id)
    if bet is None:
        raise AppError(404, "not_found", "This bet does not exist.")
    if bet["approval"] != "approved":
        raise AppError(400, "not_approved", "This bet is not live yet. Approve or decline it first.")
    result = await settle_bet(request.app, bet_id, status, outcome, admin["id"])
    if result is None:
        raise AppError(400, "bet_closed", "This bet is already closed.")
    LOGGER.info("Admin closed bet admin=%s bet=%s status=%s outcome=%s", admin["id"], bet_id, status, outcome)
    return ok(result)


async def admin_bet_resolve(request: web.Request) -> web.Response:
    return await _close_bet_as_admin(request, "resolved")


async def admin_bet_cancel(request: web.Request) -> web.Response:
    return await _close_bet_as_admin(request, "cancelled")


def setup_admin_routes(app: web.Application) -> None:
    app.router.add_post("/api/admin/users/list", admin_users_list)
    app.router.add_post("/api/admin/users/karma-history", admin_karma_history)
    app.router.add_post("/api/admin/users/set-karma", admin_set_karma)
    app.router.add_post("/api/admin/users/ban", admin_ban)
    app.router.add_post("/api/admin/wall/delete", admin_wall_delete)
    app.router.add_post("/api/admin/comments/delete", admin_comment_delete)
    app.router.add_post("/api/admin/links/delete", admin_link_delete)
    app.router.add_post("/api/admin/bets/pending", admin_bets_pending)
    app.router.add_post("/api/admin/bets/approve", admin_bet_approve)
    app.router.add_post("/api/admin/bets/decline", admin_bet_decline)
    app.router.add_post("/api/admin/bets/resolve", admin_bet_resolve)
    app.router.add_post("/api/admin/bets/cancel", admin_bet_cancel)
