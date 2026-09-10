"""Handle user directory endpoints: search users and load one user's public profile.

Edit this file when the user list, user search, or public profile data changes.
Copy the route pattern here when you add another small read-only endpoint group.
"""

from __future__ import annotations

from aiohttp import web

from backend.auth.access import require_user
from backend.db.users import get_user_by_username, row_to_public_user, search_users
from backend.http.fields import read_text
from backend.http.json_api import AppError, ok, read_json


async def users_list(request: web.Request) -> web.Response:
    require_user(request)
    payload = await read_json(request)
    query = read_text(payload, "query", label="Search", max_length=50)
    return ok({"users": await search_users(request.app["db"], query)})


async def users_get(request: web.Request) -> web.Response:
    require_user(request)
    payload = await read_json(request)
    username = read_text(payload, "username", label="Nickname", min_length=1, max_length=50)
    row = await get_user_by_username(request.app["db"], username)
    if row is None or row["is_banned"]:
        raise AppError(404, "not_found", "This user does not exist.")
    return ok({"user": row_to_public_user(row)})


def setup_user_routes(app: web.Application) -> None:
    app.router.add_post("/api/users/list", users_list)
    app.router.add_post("/api/users/get", users_get)
