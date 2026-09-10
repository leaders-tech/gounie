"""Handle account endpoints: register, email confirmation, password reset, and password change.

Edit this file when sign-up, email confirmation, or password rules change.
Copy the route pattern here when you add another small account endpoint.
"""

from __future__ import annotations

import logging
import sqlite3
from datetime import timedelta

import aiosqlite
from aiohttp import web

from backend.auth.access import require_active_user
from backend.auth.passwords import hash_password, verify_password
from backend.auth.tokens import create_email_link_token, hash_email_link_token
from backend.auth.validation import email_domain, validate_email, validate_password, validate_username
from backend.config import Settings
from backend.db.connection import parse_utc_text, utc_now, utc_now_text
from backend.db.email_tokens import (
    create_email_token,
    get_email_token,
    has_live_email_token,
    latest_email_token_created_at,
    mark_email_token_used,
)
from backend.db.refresh_sessions import delete_user_sessions
from backend.db.users import (
    confirm_user_email,
    create_pending_user,
    delete_user,
    get_user_by_email,
    get_user_by_id,
    get_user_by_username,
    set_password_hash,
)
from backend.http.json_api import AppError, ok, read_json
from backend.http.middleware import require_allowed_origin
from backend.mail.sender import send_email

LOGGER = logging.getLogger("backend.auth")
CONFIRM_TTL = timedelta(hours=24)
RESET_TTL = timedelta(hours=1)
EMAIL_COOLDOWN = timedelta(seconds=60)


async def _issue_email_token(request: web.Request, user_id: int, purpose: str, ttl: timedelta) -> str:
    settings: Settings = request.app["settings"]
    raw_token = create_email_link_token()
    expires_at = (utc_now() + ttl).isoformat(timespec="seconds")
    await create_email_token(request.app["db"], user_id, purpose, hash_email_link_token(settings, raw_token), expires_at)
    return raw_token


async def _send_confirmation_email(request: web.Request, user_id: int, email: str, username: str) -> bool:
    settings: Settings = request.app["settings"]
    raw_token = await _issue_email_token(request, user_id, "confirm", CONFIRM_TTL)
    link = f"{settings.frontend_origin}/confirm?token={raw_token}"
    body = (
        f"Hi {username}!\n\n"
        "Welcome to gounie. Open this link to confirm your email:\n\n"
        f"{link}\n\n"
        "The link works for 24 hours. If you did not sign up, just ignore this email.\n"
    )
    return await send_email(request.app, email, "Confirm your gounie account", body)


async def _is_stale_unconfirmed(db: aiosqlite.Connection, row: aiosqlite.Row) -> bool:
    """An unconfirmed account whose confirmation link expired can be replaced by a new sign-up."""
    if row["email_confirmed_at"] is not None or row["is_admin"]:
        return False
    return not await has_live_email_token(db, row["id"], "confirm", utc_now_text())


async def _in_cooldown(db: aiosqlite.Connection, user_id: int, purpose: str) -> bool:
    latest = await latest_email_token_created_at(db, user_id, purpose)
    return latest is not None and parse_utc_text(latest) > utc_now() - EMAIL_COOLDOWN


async def _read_valid_token(request: web.Request, token: str, purpose: str) -> aiosqlite.Row | None:
    settings: Settings = request.app["settings"]
    if not token:
        return None
    row = await get_email_token(request.app["db"], hash_email_link_token(settings, token), purpose)
    if row is None or row["used_at"] is not None or parse_utc_text(row["expires_at"]) <= utc_now():
        return None
    return row


async def register(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    payload = await read_json(request)
    settings: Settings = request.app["settings"]
    db = request.app["db"]
    username = str(payload.get("username", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))

    problem = validate_username(username) or validate_email(email, settings.allowed_email_domains) or validate_password(password)
    if problem:
        LOGGER.info("Registration rejected nickname=%s domain=%s reason=%s", username, email_domain(email), problem)
        raise AppError(400, "bad_request", problem)

    existing = await get_user_by_username(db, username)
    if existing is not None:
        if not await _is_stale_unconfirmed(db, existing):
            raise AppError(409, "nickname_taken", "This nickname is already taken.")
        LOGGER.info("Removing stale unconfirmed user=%s so the nickname can be reused.", existing["id"])
        await delete_user(db, existing["id"])

    existing = await get_user_by_email(db, email)
    if existing is not None:
        if not await _is_stale_unconfirmed(db, existing):
            raise AppError(409, "email_taken", "This email is already used by another account.")
        LOGGER.info("Removing stale unconfirmed user=%s so the email can be reused.", existing["id"])
        await delete_user(db, existing["id"])

    try:
        user_id = await create_pending_user(db, username, email, hash_password(password))
    except sqlite3.IntegrityError as error:
        raise AppError(409, "already_exists", "This nickname or email is already used.") from error

    sent = await _send_confirmation_email(request, user_id, email, username)
    LOGGER.info("Registered user=%s nickname=%s domain=%s email_sent=%s", user_id, username, email_domain(email), sent)
    return ok({"registered": True, "email_sent": sent})


async def confirm_email(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    payload = await read_json(request)
    db = request.app["db"]
    token_row = await _read_valid_token(request, str(payload.get("token", "")).strip(), "confirm")
    if token_row is None or not await mark_email_token_used(db, token_row["id"]):
        LOGGER.info("Email confirmation failed: invalid, used, or expired token.")
        raise AppError(400, "invalid_token", "This confirmation link is invalid or expired. You can ask for a new one on the login page.")
    await confirm_user_email(db, token_row["user_id"])
    user_row = await get_user_by_id(db, token_row["user_id"])
    username = user_row["username"] if user_row is not None else ""
    LOGGER.info("Email confirmed user=%s nickname=%s", token_row["user_id"], username)
    return ok({"confirmed": True, "username": username})


async def resend_confirmation(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    payload = await read_json(request)
    db = request.app["db"]
    username = str(payload.get("username", "")).strip()
    if not username:
        raise AppError(400, "bad_request", "Nickname is required.")
    row = await get_user_by_username(db, username)
    if row is None:
        raise AppError(404, "not_found", "No account with this nickname.")
    if row["email_confirmed_at"] is not None or row["is_admin"] or not row["email"]:
        raise AppError(400, "already_confirmed", "This account is already confirmed. You can log in.")
    if await _in_cooldown(db, row["id"], "confirm"):
        LOGGER.info("Confirmation resend blocked by cooldown user=%s", row["id"])
        raise AppError(429, "too_many_requests", "Please wait a minute before asking for another email.")
    sent = await _send_confirmation_email(request, row["id"], row["email"], row["username"])
    LOGGER.info("Confirmation email resent user=%s sent=%s", row["id"], sent)
    if not sent:
        raise AppError(502, "email_failed", "Could not send the email right now. Please try again later.")
    return ok({"sent": True})


async def forgot_password(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    payload = await read_json(request)
    settings: Settings = request.app["settings"]
    db = request.app["db"]
    email = str(payload.get("email", "")).strip().lower()
    if not email:
        raise AppError(400, "bad_request", "Email is required.")

    row = await get_user_by_email(db, email)
    # Always answer the same way, so nobody can find out which emails have accounts.
    if row is None or row["email_confirmed_at"] is None or row["is_banned"]:
        LOGGER.info("Password reset requested for unknown, unconfirmed, or banned account domain=%s", email_domain(email))
        return ok({"sent": True})
    if await _in_cooldown(db, row["id"], "reset"):
        LOGGER.info("Password reset email skipped by cooldown user=%s", row["id"])
        return ok({"sent": True})

    raw_token = await _issue_email_token(request, row["id"], "reset", RESET_TTL)
    link = f"{settings.frontend_origin}/reset?token={raw_token}"
    body = (
        f"Hi {row['username']}!\n\n"
        "Someone asked to reset your gounie password. Open this link to choose a new password:\n\n"
        f"{link}\n\n"
        "The link works for 1 hour. If you did not ask for this, just ignore this email.\n"
    )
    sent = await send_email(request.app, row["email"], "Reset your gounie password", body)
    LOGGER.info("Password reset email user=%s sent=%s", row["id"], sent)
    return ok({"sent": True})


async def reset_password(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    payload = await read_json(request)
    db = request.app["db"]
    password = str(payload.get("password", ""))
    problem = validate_password(password)
    if problem:
        raise AppError(400, "bad_request", problem)
    token_row = await _read_valid_token(request, str(payload.get("token", "")).strip(), "reset")
    if token_row is None or not await mark_email_token_used(db, token_row["id"]):
        LOGGER.info("Password reset failed: invalid, used, or expired token.")
        raise AppError(400, "invalid_token", "This reset link is invalid or expired. Please ask for a new one.")
    await set_password_hash(db, token_row["user_id"], hash_password(password))
    await delete_user_sessions(db, token_row["user_id"])
    LOGGER.info("Password reset done user=%s. All sessions were logged out.", token_row["user_id"])
    return ok({"reset": True})


async def change_password(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    user = await require_active_user(request)
    payload = await read_json(request)
    db = request.app["db"]
    old_password = str(payload.get("old_password", ""))
    new_password = str(payload.get("new_password", ""))
    row = await get_user_by_id(db, user["id"])
    if row is None or not verify_password(row["password_hash"], old_password):
        LOGGER.info("Password change rejected (wrong current password) user=%s", user["id"])
        raise AppError(400, "wrong_password", "Your current password is wrong.")
    problem = validate_password(new_password)
    if problem:
        raise AppError(400, "bad_request", problem)
    await set_password_hash(db, user["id"], hash_password(new_password))
    LOGGER.info("Password changed user=%s", user["id"])
    return ok({"changed": True})


def setup_account_routes(app: web.Application) -> None:
    app.router.add_post("/api/auth/register", register)
    app.router.add_post("/api/auth/confirm", confirm_email)
    app.router.add_post("/api/auth/resend-confirmation", resend_confirmation)
    app.router.add_post("/api/auth/forgot-password", forgot_password)
    app.router.add_post("/api/auth/reset-password", reset_password)
    app.router.add_post("/api/auth/change-password", change_password)
