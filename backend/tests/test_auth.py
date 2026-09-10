"""Test backend auth flows, roles, bans, cookies, and auth-related CORS behavior.

Edit this file when login, refresh, logout, ban, or admin-access behavior changes.
Copy a test pattern here when you add another auth rule or auth endpoint.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from backend.auth.passwords import hash_password, verify_password
from backend.auth.tokens import build_access_token
from backend.config import DEFAULT_COOKIE_SECRET, Settings
from backend.db.refresh_sessions import count_sessions
from backend.db.users import create_user_if_missing, set_user_banned
from backend.main import create_app
from backend.tests.conftest import api, login, login_as


def test_password_hashing() -> None:
    password_hash = hash_password("secret")
    assert password_hash != "secret"
    assert verify_password(password_hash, "secret") is True
    assert verify_password(password_hash, "wrong") is False


@pytest.mark.asyncio
async def test_login_success_and_me(client, create_user, auth_headers) -> None:
    await create_user("user", "user")
    response = await client.post("/api/auth/login", json={"username": "user", "password": "user"}, headers=auth_headers)
    assert response.status == 200
    payload = await response.json()
    assert payload["ok"] is True
    assert payload["data"]["user"]["username"] == "user"

    me_response = await client.post("/api/auth/me", json={})
    assert me_response.status == 200
    me_payload = await me_response.json()
    assert me_payload["data"]["user"]["karma"] == 0
    assert "email" not in me_payload["data"]["user"]


@pytest.mark.asyncio
async def test_login_is_case_insensitive_for_nickname(client, create_user, auth_headers) -> None:
    await create_user("Alice", "password1")
    response = await client.post("/api/auth/login", json={"username": "alice", "password": "password1"}, headers=auth_headers)
    assert response.status == 200


@pytest.mark.asyncio
async def test_login_invalid_credentials(client, create_user, auth_headers) -> None:
    await create_user("user", "user")
    response = await client.post("/api/auth/login", json={"username": "user", "password": "wrong"}, headers=auth_headers)
    assert response.status == 401


@pytest.mark.asyncio
async def test_login_blocked_until_email_confirmed(client, db, auth_headers) -> None:
    await create_user_if_missing(db, "pending", hash_password("password1"), False, email="pending@example.edu", confirmed=False)
    response = await client.post("/api/auth/login", json={"username": "pending", "password": "password1"}, headers=auth_headers)
    payload = await response.json()
    assert response.status == 403
    assert payload["error"]["code"] == "email_not_confirmed"


@pytest.mark.asyncio
async def test_banned_user_cannot_login(client, db, create_user, auth_headers) -> None:
    user_id = await create_user("bad", "password1")
    await set_user_banned(db, user_id, True)
    response = await client.post("/api/auth/login", json={"username": "bad", "password": "password1"}, headers=auth_headers)
    payload = await response.json()
    assert response.status == 403
    assert payload["error"]["code"] == "banned"


@pytest.mark.asyncio
async def test_banned_user_with_old_cookie_is_blocked(client, db, create_user) -> None:
    user_id = await create_user("bad", "password1")
    cookies = await login_as(client, "bad")
    await set_user_banned(db, user_id, True)

    status, payload = await api(client, "/api/wall/post", {"username": "bad", "text": "hi", "color": "#fef08a", "tilt": 0}, cookies)
    assert status == 403
    assert payload["error"]["code"] == "banned"
    status, _ = await api(client, "/api/auth/me", {}, cookies)
    assert status == 401


@pytest.mark.asyncio
async def test_requires_auth(client) -> None:
    response = await client.post("/api/users/list", json={})
    assert response.status == 401


@pytest.mark.asyncio
async def test_tampered_access_cookie_returns_401(client, create_user, auth_headers, extract_cookie) -> None:
    await create_user("user", "user")
    await login(client, "user", "user", auth_headers)
    access_cookie = extract_cookie(client, "gounie_access", "/")

    response = await client.post("/api/auth/me", json={}, cookies={"gounie_access": f"{access_cookie}tampered"})
    assert response.status == 401


@pytest.mark.asyncio
async def test_expired_access_cookie_returns_401(client, create_user) -> None:
    await create_user("user", "user")
    expired_settings = Settings(
        mode="test",
        host="127.0.0.1",
        port=8081,
        db_path=client.app["settings"].db_path,
        cookie_secret=client.app["settings"].cookie_secret,
        frontend_origin=client.app["settings"].frontend_origin,
        access_ttl_seconds=-1,
    )
    expired_token = build_access_token(expired_settings, {"id": 1, "username": "user", "is_admin": False})

    response = await client.post("/api/auth/me", json={}, cookies={"gounie_access": expired_token})
    assert response.status == 401


@pytest.mark.asyncio
async def test_auth_error_keeps_cors_headers_for_localhost_origin(client) -> None:
    response = await client.post("/api/auth/me", json={}, headers={"Origin": "http://localhost:5101"})
    assert response.status == 401
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5101"
    assert response.headers["Access-Control-Allow-Credentials"] == "true"


@pytest.mark.asyncio
async def test_wrong_origin_is_rejected(client, create_user) -> None:
    await create_user("user", "user")
    response = await client.post("/api/auth/login", json={"username": "user", "password": "user"}, headers={"Origin": "http://evil.example"})
    assert response.status == 403


@pytest.mark.asyncio
async def test_admin_forbidden_for_normal_user(client, create_user, auth_headers) -> None:
    await create_user("user", "user")
    await login(client, "user", "user", auth_headers)
    response = await client.post("/api/admin/users/list", json={})
    assert response.status == 403


@pytest.mark.asyncio
async def test_non_json_write_request_returns_400(client, create_user, auth_headers) -> None:
    await create_user("user", "user")
    await login(client, "user", "user", auth_headers)

    response = await client.post(
        "/api/wall/post",
        data="text=bad",
        headers={"Origin": "http://127.0.0.1:5101", "Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status == 400


@pytest.mark.asyncio
async def test_refresh_rotates_token(client, create_user, auth_headers, extract_cookie) -> None:
    await create_user("user", "user")
    await login(client, "user", "user", auth_headers)
    first_refresh = extract_cookie(client, "gounie_refresh")

    refresh_response = await client.post("/api/auth/refresh", json={}, headers=auth_headers)
    assert refresh_response.status == 200
    second_refresh = extract_cookie(client, "gounie_refresh")
    assert second_refresh != first_refresh

    invalid_response = await client.post("/api/auth/refresh", json={}, headers=auth_headers, cookies={"gounie_refresh": first_refresh})
    assert invalid_response.status == 401


@pytest.mark.asyncio
async def test_refresh_reuse_revokes_session(client, create_user, auth_headers, extract_cookie, db) -> None:
    await create_user("user", "user")
    await login(client, "user", "user", auth_headers)
    first_refresh = extract_cookie(client, "gounie_refresh")

    refresh_response = await client.post("/api/auth/refresh", json={}, headers=auth_headers)
    assert refresh_response.status == 200
    assert await count_sessions(db) == 1

    invalid_response = await client.post("/api/auth/refresh", json={}, headers=auth_headers, cookies={"gounie_refresh": first_refresh})
    assert invalid_response.status == 401
    assert await count_sessions(db) == 0


@pytest.mark.asyncio
async def test_refresh_fails_for_banned_user(client, create_user, auth_headers, db) -> None:
    user_id = await create_user("user", "user")
    await login(client, "user", "user", auth_headers)
    await db.execute("UPDATE users SET is_banned = 1 WHERE id = ?", (user_id,))
    await db.commit()

    response = await client.post("/api/auth/refresh", json={}, headers=auth_headers)
    assert response.status == 401
    assert await count_sessions(db) == 0


@pytest.mark.asyncio
async def test_expired_refresh_session_returns_401_and_deletes_session(client, create_user, auth_headers, db) -> None:
    await create_user("user", "user")
    await login(client, "user", "user", auth_headers)
    assert await count_sessions(db) == 1

    expired_at = (datetime.now(tz=UTC) - timedelta(minutes=1)).isoformat(timespec="seconds")
    await db.execute("UPDATE refresh_sessions SET expires_at = ? WHERE id IS NOT NULL", (expired_at,))
    await db.commit()

    response = await client.post("/api/auth/refresh", json={}, headers=auth_headers)
    assert response.status == 401
    assert await count_sessions(db) == 0


@pytest.mark.asyncio
async def test_logout_removes_refresh_session(client, create_user, auth_headers, db) -> None:
    await create_user("user", "user")
    await login(client, "user", "user", auth_headers)
    assert await count_sessions(db) == 1

    response = await client.post("/api/auth/logout", json={}, headers=auth_headers)
    assert response.status == 200
    assert await count_sessions(db) == 0


def test_create_app_refuses_default_secret_in_prod(tmp_path) -> None:
    settings = Settings(
        mode="prod",
        host="127.0.0.1",
        port=8081,
        db_path=tmp_path / "prod.sqlite3",
        cookie_secret=DEFAULT_COOKIE_SECRET,
        frontend_origin="http://127.0.0.1:5101",
    )

    with pytest.raises(ValueError, match="default COOKIE_SECRET"):
        create_app(settings)
