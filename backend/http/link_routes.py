"""Handle the great url collection endpoints: search, add, edit, delete, and vote on links.

Edit this file when link rules, link search, or link voting changes.
Copy the route pattern here when you add another searchable collection with votes.
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlsplit

from aiohttp import web

from backend.auth.access import current_user, require_active_user
from backend.db.links import create_link, delete_link, get_link, get_link_vote, list_links, save_link_vote, update_link
from backend.db.karma import change_karma
from backend.http.fields import read_id, read_int, read_text
from backend.http.json_api import AppError, ok, read_json
from backend.http.middleware import require_allowed_origin

LOGGER = logging.getLogger("backend.links")


def read_link_fields(payload: dict[str, Any]) -> tuple[str, str, str]:
    url = read_text(payload, "url", label="URL", min_length=1, max_length=2000)
    parsed = urlsplit(url)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc:
        raise AppError(400, "bad_request", "URL must start with http:// or https://.")
    title = read_text(payload, "title", label="Title", min_length=1, max_length=200)
    description = read_text(payload, "description", label="Description", max_length=1000)
    return url, title, description


async def load_own_link(request: web.Request, link_id: int, user: dict[str, Any]) -> dict[str, Any]:
    link = await get_link(request.app["db"], link_id, user["id"])
    if link is None:
        raise AppError(404, "not_found", "This link does not exist.")
    if link["author_id"] != user["id"]:
        LOGGER.info("Link change rejected (not author) link=%s user=%s", link_id, user["id"])
        raise AppError(403, "not_allowed", "You can only change your own links.")
    return link


async def links_list(request: web.Request) -> web.Response:
    """Anyone can read the links, also without an account. Visitors just have no votes of their own."""
    user = current_user(request)
    payload = await read_json(request)
    query = read_text(payload, "query", label="Search", max_length=200)
    viewer_id = user["id"] if user else 0
    return ok({"links": await list_links(request.app["db"], viewer_id, query)})


async def links_create(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    user = await require_active_user(request)
    url, title, description = read_link_fields(await read_json(request))
    db = request.app["db"]
    link_id = await create_link(db, user["id"], url, title, description)
    LOGGER.info("Link created link=%s author=%s url=%s", link_id, user["id"], url)
    await request.app["ws_hub"].broadcast({"type": "links.changed"})
    return ok({"link": await get_link(db, link_id, user["id"])})


async def links_update(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    user = await require_active_user(request)
    payload = await read_json(request)
    link = await load_own_link(request, read_id(payload), user)
    url, title, description = read_link_fields(payload)
    db = request.app["db"]
    await update_link(db, link["id"], url, title, description)
    LOGGER.info("Link updated link=%s author=%s url=%s", link["id"], user["id"], url)
    await request.app["ws_hub"].broadcast({"type": "links.changed"})
    return ok({"link": await get_link(db, link["id"], user["id"])})


async def links_delete(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    user = await require_active_user(request)
    payload = await read_json(request)
    link = await load_own_link(request, read_id(payload), user)
    await delete_link(request.app["db"], link["id"])
    LOGGER.info("Link deleted link=%s author=%s", link["id"], user["id"])
    await request.app["ws_hub"].broadcast({"type": "links.changed"})
    return ok({"deleted": True, "id": link["id"]})


async def links_vote(request: web.Request) -> web.Response:
    require_allowed_origin(request)
    user = await require_active_user(request)
    payload = await read_json(request)
    link_id = read_id(payload, "link_id")
    value = read_int(payload, "value", label="Vote", minimum=-1, maximum=1)
    db = request.app["db"]
    author_karma = None
    async with request.app["karma_lock"]:
        link = await get_link(db, link_id, user["id"])
        if link is None:
            raise AppError(404, "not_found", "This link does not exist.")
        if link["author_id"] == user["id"]:
            raise AppError(400, "own_link", "You can't vote on your own link.")
        old_value = await get_link_vote(db, link_id, user["id"])
        delta = value - old_value
        if delta != 0:
            try:
                await save_link_vote(db, link_id, user["id"], value, delta)
                author_karma = await change_karma(db, link["author_id"], delta, "link_vote", link_id, commit=False)
                await db.commit()
            except Exception:
                await db.rollback()
                raise
    if author_karma is not None:
        LOGGER.info("Link vote link=%s voter=%s value=%s delta=%+d author=%s", link_id, user["id"], value, delta, link["author_id"])
        await request.app["ws_hub"].send_to_user(link["author_id"], {"type": "karma.changed", "karma": author_karma})
        await request.app["ws_hub"].broadcast({"type": "links.changed"})
    return ok({"link": await get_link(db, link_id, user["id"])})


def setup_link_routes(app: web.Application) -> None:
    app.router.add_post("/api/links/list", links_list)
    app.router.add_post("/api/links/create", links_create)
    app.router.add_post("/api/links/update", links_update)
    app.router.add_post("/api/links/delete", links_delete)
    app.router.add_post("/api/links/vote", links_vote)
