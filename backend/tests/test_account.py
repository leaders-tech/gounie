"""Test sign-up, email confirmation, resend, forgot/reset password, change password, and email failures.

Edit this file when account endpoints, email links, or password rules change.
Copy a test pattern here when you add another account or email flow.
"""

from __future__ import annotations

import logging
import re
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from backend.main import create_app
from backend.tests.conftest import api, login_as

PAST = (datetime.now(tz=UTC) - timedelta(days=2)).isoformat(timespec="seconds")


async def latest_token(client) -> str:
    status, payload = await api(client, "/api/dev/outbox")
    assert status == 200
    body = payload["data"]["messages"][0]["body"]
    match = re.search(r"token=([A-Za-z0-9_-]+)", body)
    assert match is not None
    return match.group(1)


async def register(client, username="alice", email="alice@example.edu", password="password1"):
    return await api(client, "/api/auth/register", {"username": username, "email": email, "password": password})


async def login_status(client, username, password="password1") -> tuple[int, dict]:
    status, payload = await api(client, "/api/auth/login", {"username": username, "password": password})
    client.session.cookie_jar.clear()
    return status, payload


@pytest.mark.asyncio
async def test_register_confirm_and_login(client) -> None:
    status, payload = await register(client, email="Alice@Example.EDU")
    assert status == 200
    assert payload["data"] == {"registered": True, "email_sent": True}

    status, payload = await login_status(client, "alice")
    assert status == 403
    assert payload["error"]["code"] == "email_not_confirmed"

    token = await latest_token(client)
    status, payload = await api(client, "/api/auth/confirm", {"token": token})
    assert status == 200
    assert payload["data"]["username"] == "alice"

    status, _ = await api(client, "/api/auth/confirm", {"token": token})
    assert status == 400

    status, _ = await login_status(client, "alice")
    assert status == 200


@pytest.mark.asyncio
async def test_confirmation_email_contains_frontend_link(client) -> None:
    await register(client)
    _, payload = await api(client, "/api/dev/outbox")
    message = payload["data"]["messages"][0]
    assert message["to"] == "alice@example.edu"
    assert "http://127.0.0.1:5101/confirm?token=" in message["body"]


@pytest.mark.asyncio
async def test_register_rejects_wrong_domain(client) -> None:
    status, payload = await register(client, email="alice@gmail.com")
    assert status == 400
    assert "allowed" in payload["error"]["message"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("username", "email", "password"),
    [
        ("ab", "alice@example.edu", "password1"),
        ("bad name", "alice@example.edu", "password1"),
        ("a" * 21, "alice@example.edu", "password1"),
        ("alice", "not-an-email", "password1"),
        ("alice", "alice@example.edu", "short"),
    ],
)
async def test_register_rejects_bad_input(client, username, email, password) -> None:
    status, _ = await register(client, username=username, email=email, password=password)
    assert status == 400


@pytest.mark.asyncio
async def test_register_rejects_taken_nickname_and_email(client, create_user) -> None:
    await create_user("alice")
    status, payload = await register(client, username="ALICE", email="other@example.edu")
    assert status == 409
    assert payload["error"]["code"] == "nickname_taken"

    status, payload = await register(client, username="someone", email="alice@example.edu")
    assert status == 409
    assert payload["error"]["code"] == "email_taken"


@pytest.mark.asyncio
async def test_pending_signup_blocks_until_link_expires_then_can_be_replaced(client, db) -> None:
    assert (await register(client))[0] == 200
    status, _ = await register(client, email="second@example.edu")
    assert status == 409

    await db.execute("UPDATE email_tokens SET expires_at = ?", (PAST,))
    await db.commit()
    status, _ = await register(client, email="second@example.edu")
    assert status == 200
    cursor = await db.execute("SELECT email FROM users WHERE username = 'alice'")
    assert (await cursor.fetchone())["email"] == "second@example.edu"


@pytest.mark.asyncio
async def test_expired_confirmation_token_is_rejected(client, db) -> None:
    await register(client)
    token = await latest_token(client)
    await db.execute("UPDATE email_tokens SET expires_at = ?", (PAST,))
    await db.commit()
    status, payload = await api(client, "/api/auth/confirm", {"token": token})
    assert status == 400
    assert payload["error"]["code"] == "invalid_token"


@pytest.mark.asyncio
async def test_resend_confirmation_has_cooldown_and_replaces_old_link(client, db) -> None:
    await register(client)
    old_token = await latest_token(client)

    status, payload = await api(client, "/api/auth/resend-confirmation", {"username": "alice"})
    assert status == 429

    await db.execute("UPDATE email_tokens SET created_at = ?", (PAST,))
    await db.commit()
    status, _ = await api(client, "/api/auth/resend-confirmation", {"username": "alice"})
    assert status == 200
    new_token = await latest_token(client)
    assert new_token != old_token

    assert (await api(client, "/api/auth/confirm", {"token": old_token}))[0] == 400
    assert (await api(client, "/api/auth/confirm", {"token": new_token}))[0] == 200


@pytest.mark.asyncio
async def test_resend_confirmation_errors(client, create_user) -> None:
    await create_user("done")
    status, payload = await api(client, "/api/auth/resend-confirmation", {"username": "done"})
    assert status == 400
    assert payload["error"]["code"] == "already_confirmed"
    status, _ = await api(client, "/api/auth/resend-confirmation", {"username": "nobody"})
    assert status == 404


@pytest.mark.asyncio
async def test_forgot_and_reset_password(client, create_user, db) -> None:
    await create_user("alice", "password1")
    status, _ = await api(client, "/api/auth/forgot-password", {"email": "ALICE@example.edu"})
    assert status == 200
    token = await latest_token(client)

    status, _ = await api(client, "/api/auth/reset-password", {"token": token, "password": "short"})
    assert status == 400
    status, _ = await api(client, "/api/auth/reset-password", {"token": token, "password": "newpassword1"})
    assert status == 200

    assert (await login_status(client, "alice", "password1"))[0] == 401
    assert (await login_status(client, "alice", "newpassword1"))[0] == 200
    assert (await api(client, "/api/auth/reset-password", {"token": token, "password": "another-pass1"}))[0] == 400


@pytest.mark.asyncio
async def test_reset_logs_out_other_sessions(client, create_user, db) -> None:
    await create_user("alice", "password1")
    await login_as(client, "alice")
    cursor = await db.execute("SELECT COUNT(*) AS count FROM refresh_sessions")
    assert (await cursor.fetchone())["count"] == 1

    await api(client, "/api/auth/forgot-password", {"email": "alice@example.edu"})
    await api(client, "/api/auth/reset-password", {"token": await latest_token(client), "password": "newpassword1"})
    cursor = await db.execute("SELECT COUNT(*) AS count FROM refresh_sessions")
    assert (await cursor.fetchone())["count"] == 0


@pytest.mark.asyncio
async def test_forgot_password_for_unknown_email_sends_nothing(client) -> None:
    status, payload = await api(client, "/api/auth/forgot-password", {"email": "ghost@example.edu"})
    assert status == 200
    assert payload["data"] == {"sent": True}
    _, outbox = await api(client, "/api/dev/outbox")
    assert outbox["data"]["messages"] == []


@pytest.mark.asyncio
async def test_change_password(client, create_user) -> None:
    await create_user("alice", "password1")
    cookies = await login_as(client, "alice")

    status, payload = await api(client, "/api/auth/change-password", {"old_password": "wrong", "new_password": "newpassword1"}, cookies)
    assert status == 400
    assert payload["error"]["code"] == "wrong_password"
    status, _ = await api(client, "/api/auth/change-password", {"old_password": "password1", "new_password": "short"}, cookies)
    assert status == 400
    status, _ = await api(client, "/api/auth/change-password", {"old_password": "password1", "new_password": "newpassword1"}, cookies)
    assert status == 200

    assert (await login_status(client, "alice", "newpassword1"))[0] == 200


@pytest.mark.asyncio
async def test_change_password_requires_login(client) -> None:
    status, _ = await api(client, "/api/auth/change-password", {"old_password": "a", "new_password": "b"})
    assert status == 401


@pytest.mark.asyncio
async def test_smtp_failure_is_logged_and_reported(aiohttp_client, test_settings, monkeypatch, caplog) -> None:
    settings = replace(test_settings, email_mode="smtp", smtp_host="smtp.invalid", smtp_user="user", smtp_password="pass", email_from="gounie@example.edu")
    client = await aiohttp_client(create_app(settings))

    def broken_smtp(*_args) -> None:
        raise OSError("network is down")

    monkeypatch.setattr("backend.mail.sender._send_smtp", broken_smtp)
    with caplog.at_level(logging.ERROR, logger="backend.email"):
        status, payload = await register(client)

    assert status == 200
    assert payload["data"]["email_sent"] is False
    assert "Email sending failed to=alice@example.edu" in caplog.text
    assert "network is down" in caplog.text


@pytest.mark.asyncio
async def test_smtp_mode_sends_through_smtp_helper(aiohttp_client, test_settings, monkeypatch) -> None:
    settings = replace(test_settings, email_mode="smtp", smtp_host="smtp.example.edu", smtp_user="user", smtp_password="pass", email_from="gounie@example.edu")
    client = await aiohttp_client(create_app(settings))
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr("backend.mail.sender._send_smtp", lambda _settings, to, subject, _body: sent.append((to, subject)))

    status, payload = await register(client)
    assert status == 200
    assert payload["data"]["email_sent"] is True
    assert sent == [("alice@example.edu", "Confirm your gounie account")]
    assert client.app["email_outbox"] == []
