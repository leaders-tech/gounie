"""Build and run the backend aiohttp application.

Edit this file when startup, cleanup, or top-level route setup changes.
Do not copy this file. Change it when the whole backend app boot flow changes.
"""

from __future__ import annotations

import asyncio
import logging

from aiohttp import web

from backend.auth.account_routes import setup_account_routes
from backend.auth.routes import setup_auth_routes
from backend.config import Settings, load_settings, validate_settings
from backend.db.connection import open_db
from backend.db.migrations import run_migrations
from backend.db.seed import ensure_admin, seed_dev_data
from backend.http.admin_routes import setup_admin_routes
from backend.http.bet_routes import setup_bet_routes
from backend.http.link_routes import setup_link_routes
from backend.http.middleware import cors_middleware, error_middleware, request_logging_middleware
from backend.http.routes import setup_api_routes
from backend.http.slot_routes import setup_slot_routes
from backend.http.user_routes import setup_user_routes
from backend.http.wall_routes import setup_wall_routes
from backend.jobs import start_jobs, stop_jobs
from backend.logging_config import configure_logging
from backend.ws.hub import WebSocketHub
from backend.ws.routes import setup_ws_routes

LOGGER = logging.getLogger("backend.app")
MAX_REQUEST_BYTES = 8 * 1024 * 1024


async def on_startup(app: web.Application) -> None:
    settings: Settings = app["settings"]
    LOGGER.info(
        "Starting backend mode=%s host=%s port=%s db=%s frontend=%s debug_logs=%s email_mode=%s allowed_domains=%s karma_floor=%s",
        settings.mode,
        settings.host,
        settings.port,
        settings.db_path,
        settings.frontend_origin,
        settings.debug_logs,
        settings.email_mode,
        ",".join(settings.allowed_email_domains),
        settings.karma_floor,
    )
    if settings.mode == "prod" and settings.email_mode == "log":
        LOGGER.warning("EMAIL_MODE=log in prod: confirmation emails are only written to the log. Set EMAIL_MODE=smtp to really send them.")
    LOGGER.info("Running database migrations.")
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    run_migrations(settings.db_path, settings.migrations_path)
    LOGGER.info("Database migrations finished.")
    app["db"] = await open_db(settings.db_path)
    await ensure_admin(app["db"], settings)
    await seed_dev_data(app["db"], settings)
    if settings.mode != "test":
        start_jobs(app)
    LOGGER.info("Backend startup finished.")


async def on_cleanup(app: web.Application) -> None:
    await stop_jobs(app)
    db = app.get("db")
    if db is not None:
        await db.close()
        LOGGER.info("Database connection closed.")


def create_app(settings: Settings | None = None) -> web.Application:
    resolved_settings = settings or load_settings()
    validate_settings(resolved_settings)
    configure_logging(resolved_settings)
    app = web.Application(
        middlewares=[request_logging_middleware, error_middleware, cors_middleware],
        client_max_size=MAX_REQUEST_BYTES,
    )
    app["settings"] = resolved_settings
    app["ws_hub"] = WebSocketHub()
    app["karma_lock"] = asyncio.Lock()
    app["email_outbox"] = []

    setup_auth_routes(app)
    setup_account_routes(app)
    setup_api_routes(app)
    setup_user_routes(app)
    setup_wall_routes(app)
    setup_bet_routes(app)
    setup_link_routes(app)
    setup_slot_routes(app)
    setup_admin_routes(app)
    setup_ws_routes(app)

    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


def run() -> None:
    settings = load_settings()
    web.run_app(create_app(settings), host=settings.host, port=settings.port)


if __name__ == "__main__":
    run()
