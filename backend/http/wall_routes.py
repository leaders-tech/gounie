"""Handle The Wall endpoints: list notes, post a note, rotate a note, the fake delete, and note pictures.

Edit this file when wall note rules, note looks, note rotation, note pictures, or the fake delete behavior changes.
Copy the route pattern here when you add another endpoint group for user-posted content.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from aiohttp import web

from backend.auth.access import require_active_user, require_user
from backend.db.users import get_user_by_username, row_to_public_user
from backend.db.wall import NOTE_STYLE_FLAGS, create_wall_note, get_wall_image, get_wall_note, list_wall_notes, update_wall_note_tilt
from backend.http.fields import read_bool, read_hex_color, read_id, read_int, read_text
from backend.http.json_api import AppError, ok, read_json
from backend.http.middleware import require_allowed_origin
from backend.images import ImageError, prepare_wall_image

LOGGER = logging.getLogger("backend.wall")
NOTE_TEXT_MAX = 500
MAX_TILT = 180
DEFAULT_NOTE_COLOR = "#fef08a"
DEFAULT_TEXT_COLOR = "#1c1917"
WHOOPS_MESSAGE = "whoops.. something went wrong"


def read_note_style(payload: dict[str, Any]) -> dict[str, Any]:
    """Read the note look: note color, text color, tilt, and the bold/italic/underline/strikethrough switches."""
    style: dict[str, Any] = {
        "color": read_hex_color(payload, "color", label="Note color", default=DEFAULT_NOTE_COLOR),
        "text_color": read_hex_color(payload, "text_color", label="Text color", default=DEFAULT_TEXT_COLOR),
        "tilt": read_int(payload, "tilt", label="Rotation", minimum=-MAX_TILT, maximum=MAX_TILT),
    }
    for flag in NOTE_STYLE_FLAGS:
        style[flag] = read_bool(payload, flag, label=flag.capitalize())
    return style


def describe_style(style: dict[str, Any]) -> str:
    text_styles = ",".join(flag for flag in NOTE_STYLE_FLAGS if style[flag]) or "regular"
    return f"tilt={style['tilt']} color={style['color']} text_color={style['text_color']} text_style={text_styles}"


async def _load_wall_owner(request: web.Request, username: str):
    row = await get_user_by_username(request.app["db"], username)
    if row is None or row["is_banned"]:
        raise AppError(404, "not_found", "This user does not exist.")
    return row


async def wall_list(request: web.Request) -> web.Response:
    require_user(request)
    payload = await read_json(request)
    username = read_text(payload, "username", label="Nickname", min_length=1, max_length=50)
    owner = await _load_wall_owner(request, username)
    notes = await list_wall_notes(request.app["db"], owner["id"])
    return ok({"owner": row_to_public_user(owner), "notes": notes})


async def wall_post(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    user = await require_active_user(request)
    payload = await read_json(request)
    username = read_text(payload, "username", label="Nickname", min_length=1, max_length=50)
    text = read_text(payload, "text", label="Note text", max_length=NOTE_TEXT_MAX)
    style = read_note_style(payload)
    image_data = payload.get("image")
    if image_data is not None and not isinstance(image_data, str):
        raise AppError(400, "bad_request", "Picture must be a data URL.")
    if not text and not image_data:
        raise AppError(400, "bad_request", "Write something or add a picture.")

    owner = await _load_wall_owner(request, username)
    image = None
    if image_data:
        try:
            image = await asyncio.to_thread(prepare_wall_image, image_data)
        except ImageError as error:
            LOGGER.info("Wall picture rejected author=%s reason=%s", user["id"], error)
            raise AppError(400, "bad_image", str(error)) from error

    note = await create_wall_note(request.app["db"], owner["id"], user["id"], text, image, style)
    LOGGER.info(
        "Wall note posted note=%s wall=%s author=%s has_image=%s image_bytes=%s %s",
        note["id"],
        owner["id"],
        user["id"],
        image is not None,
        len(image) if image else 0,
        describe_style(style),
    )
    await request.app["ws_hub"].broadcast({"type": "wall.changed", "wall_user_id": owner["id"]})
    return ok({"note": note})


async def wall_rotate(request: web.Request) -> web.Response:
    """Let the author turn their note. The page says notes are editable, but rotation is the only thing that changes."""
    require_allowed_origin(request)
    user = await require_active_user(request)
    payload = await read_json(request)
    note_id = read_id(payload)
    tilt = read_int(payload, "tilt", label="Rotation", minimum=-MAX_TILT, maximum=MAX_TILT)
    db = request.app["db"]
    note = await get_wall_note(db, note_id)
    if note is None:
        raise AppError(404, "not_found", "This note does not exist.")
    if note["author_id"] != user["id"]:
        LOGGER.info("Wall note rotation rejected (not author) note=%s user=%s", note_id, user["id"])
        raise AppError(403, "not_allowed", "You can only edit your own notes.")
    updated = await update_wall_note_tilt(db, note_id, tilt)
    LOGGER.info("Wall note rotated note=%s author=%s old_tilt=%s new_tilt=%s", note_id, user["id"], note["tilt"], tilt)
    await request.app["ws_hub"].broadcast({"type": "wall.changed", "wall_user_id": note["wall_user_id"]})
    return ok({"note": updated})


async def wall_delete(request: web.Request) -> web.Response:
    """The joke delete button. It never deletes anything and always says whoops."""
    require_allowed_origin(request)
    user = await require_active_user(request)
    payload = await read_json(request)
    note_id = payload.get("id")
    note = await get_wall_note(request.app["db"], note_id) if isinstance(note_id, int) and not isinstance(note_id, bool) else None
    LOGGER.info(
        "Fake delete attempt user=%s note=%s note_author=%s wall_owner=%s. Nothing was deleted.",
        user["id"],
        note_id,
        note["author_id"] if note else None,
        note["wall_user_id"] if note else None,
    )
    raise AppError(409, "whoops", WHOOPS_MESSAGE)


async def wall_image(request: web.Request) -> web.Response:
    require_user(request)
    try:
        note_id = int(request.match_info["note_id"])
    except ValueError as error:
        raise AppError(404, "not_found", "Picture does not exist.") from error
    image = await get_wall_image(request.app["db"], note_id)
    if image is None:
        raise AppError(404, "not_found", "Picture does not exist.")
    return web.Response(body=image, content_type="image/webp", headers={"Cache-Control": "private, max-age=86400"})


def setup_wall_routes(app: web.Application) -> None:
    app.router.add_post("/api/wall/list", wall_list)
    app.router.add_post("/api/wall/post", wall_post)
    app.router.add_post("/api/wall/rotate", wall_rotate)
    app.router.add_post("/api/wall/delete", wall_delete)
    app.router.add_get("/api/wall/image/{note_id}", wall_image)
