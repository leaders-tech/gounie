"""Create the admin account on first start and seed simple dev-only data.

Edit this file when the admin account setup or dev-only starter users change.
Copy the small helper style here when you add another startup seed step.
"""

from __future__ import annotations

import logging

import aiosqlite

from backend.auth.passwords import hash_password
from backend.config import Settings
from backend.db.users import create_user_if_missing, user_exists

LOGGER = logging.getLogger("backend.seed")
ADMIN_USERNAME = "admin"
DEV_ADMIN_PASSWORD = "admin"
DEV_USER_PASSWORD = "userpass1"


async def ensure_admin(db: aiosqlite.Connection, settings: Settings) -> None:
    """Create the admin account once. An existing admin password is never overwritten."""
    if await user_exists(db, ADMIN_USERNAME):
        LOGGER.info("Admin account already exists.")
        return
    password = settings.admin_password
    if not password:
        if settings.mode == "prod":
            raise ValueError("ADMIN_PASSWORD is required to create the admin account in prod.")
        LOGGER.warning("ADMIN_PASSWORD is not set. Creating the dev admin account with password %r.", DEV_ADMIN_PASSWORD)
        password = DEV_ADMIN_PASSWORD
    await create_user_if_missing(db, ADMIN_USERNAME, hash_password(password), True)
    LOGGER.info("Created admin account %r.", ADMIN_USERNAME)


async def seed_dev_data(db: aiosqlite.Connection, settings: Settings) -> None:
    if settings.mode != "dev":
        return
    if not await user_exists(db, "user"):
        email = f"user@{settings.allowed_email_domains[0]}"
        await create_user_if_missing(db, "user", hash_password(DEV_USER_PASSWORD), False, email=email, confirmed=True)
        LOGGER.info("Created dev user 'user' with password %r.", DEV_USER_PASSWORD)
