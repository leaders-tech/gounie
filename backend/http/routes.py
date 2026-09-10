"""Handle small shared endpoints: health check and the dev-only email outbox.

Edit this file when the health check or dev-only helper endpoints change.
Copy the route pattern here when you add another tiny endpoint that does not fit a feature route file.
"""

from __future__ import annotations

from aiohttp import web

from backend.http.json_api import ok


async def health(request: web.Request) -> web.Response:
    return ok({"status": "ok"})


async def dev_outbox(request: web.Request) -> web.Response:
    """Show emails saved in EMAIL_MODE=log. Only registered outside prod, used by e2e tests."""
    return ok({"messages": list(reversed(request.app["email_outbox"]))})


def setup_api_routes(app: web.Application) -> None:
    app.router.add_get("/api/health", health)
    if app["settings"].mode != "prod":
        app.router.add_post("/api/dev/outbox", dev_outbox)
