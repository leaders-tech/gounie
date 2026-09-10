"""Provide shared backend test fixtures for the aiohttp test app, test database, users, and API calls.

Edit this file when many backend tests need the same fixture or helper.
Copy fixture patterns here when you add another shared backend test helper.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

import pytest
from aiohttp.test_utils import TestClient
from yarl import URL

from backend.auth.passwords import hash_password
from backend.config import Settings
from backend.db.users import create_user_if_missing, get_user_by_username
from backend.main import create_app

ORIGIN = "http://127.0.0.1:5101"
ADMIN_PASSWORD = "adminpass1"


@pytest.fixture
def test_settings(tmp_path: Path) -> Settings:
    return Settings(
        mode="test",
        host="127.0.0.1",
        port=8081,
        db_path=tmp_path / "test.sqlite3",
        cookie_secret="test-secret",
        frontend_origin=ORIGIN,
        admin_password=ADMIN_PASSWORD,
        allowed_email_domains=("example.edu",),
        email_mode="log",
    )


@pytest.fixture
async def app(test_settings: Settings):
    return create_app(test_settings)


@pytest.fixture
async def client(aiohttp_client, app) -> TestClient:
    return await aiohttp_client(app)


@pytest.fixture
async def db(client):
    return client.app["db"]


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Origin": ORIGIN}


@pytest.fixture
def create_user(db) -> Callable[..., Awaitable[int]]:
    """Create a confirmed user with an @example.edu email and return the user id."""

    async def _create_user(username: str, password: str = "password1", is_admin: bool = False, karma: int = 0) -> int:
        await create_user_if_missing(db, username, hash_password(password), is_admin, email=f"{username.lower()}@example.edu", confirmed=True)
        row = await get_user_by_username(db, username)
        assert row is not None
        if karma:
            await db.execute("UPDATE users SET karma = ? WHERE id = ?", (karma, row["id"]))
            await db.commit()
        return int(row["id"])

    return _create_user


@pytest.fixture
def extract_cookie() -> Callable[[TestClient, str, str], str]:
    def _extract_cookie(client: TestClient, name: str, path: str = "/api/auth/refresh") -> str:
        cookie = client.session.cookie_jar.filter_cookies(URL(f"http://127.0.0.1:8081{path}")).get(name)
        assert cookie is not None
        return cookie.value

    return _extract_cookie


async def login(client: TestClient, username: str, password: str, headers: dict[str, str]) -> None:
    response = await client.post("/api/auth/login", json={"username": username, "password": password}, headers=headers)
    assert response.status == 200


async def login_as(client: TestClient, username: str, password: str = "password1") -> dict[str, str]:
    """Log in and return the access cookie, so one test can act as several users with cookies=..."""
    response = await client.post("/api/auth/login", json={"username": username, "password": password}, headers={"Origin": ORIGIN})
    assert response.status == 200, await response.text()
    token = response.cookies["gounie_access"].value
    client.session.cookie_jar.clear()
    return {"gounie_access": token}


async def api(client: TestClient, path: str, body: dict[str, Any] | None = None, cookies: dict[str, str] | None = None) -> tuple[int, dict[str, Any]]:
    response = await client.post(path, json=body or {}, headers={"Origin": ORIGIN}, cookies=cookies)
    return response.status, await response.json()
