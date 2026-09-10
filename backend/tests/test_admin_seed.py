"""Test admin account creation from ADMIN_PASSWORD, dev seed users, and startup settings checks.

Edit this file when admin seeding, dev seed data, or settings validation changes.
Copy a test pattern here when you add another startup rule.
"""

from __future__ import annotations

import logging
from dataclasses import replace

import pytest

from backend.auth.passwords import verify_password
from backend.config import Settings, load_settings, parse_domains
from backend.db.users import get_user_by_username
from backend.main import create_app, on_cleanup, on_startup
from backend.tests.conftest import ADMIN_PASSWORD, api


def make_settings(tmp_path, **overrides) -> Settings:
    settings = Settings(
        mode="test",
        host="127.0.0.1",
        port=8081,
        db_path=tmp_path / "seed.sqlite3",
        cookie_secret="test-secret",
        frontend_origin="http://127.0.0.1:5101",
        admin_password="first-pass1",
    )
    return replace(settings, **overrides)


@pytest.mark.asyncio
async def test_admin_account_uses_admin_password(client) -> None:
    status, payload = await api(client, "/api/auth/login", {"username": "admin", "password": ADMIN_PASSWORD})
    assert status == 200
    assert payload["data"]["user"]["is_admin"] is True
    client.session.cookie_jar.clear()
    status, _ = await api(client, "/api/auth/login", {"username": "admin", "password": "admin"})
    assert status == 401


@pytest.mark.asyncio
async def test_admin_password_is_not_overwritten_on_restart(tmp_path) -> None:
    settings = make_settings(tmp_path)
    first = create_app(settings)
    await on_startup(first)
    await on_cleanup(first)

    second = create_app(replace(settings, admin_password="second-pass1"))
    await on_startup(second)
    try:
        row = await get_user_by_username(second["db"], "admin")
        assert row is not None
        assert verify_password(row["password_hash"], "first-pass1")
        assert not verify_password(row["password_hash"], "second-pass1")
    finally:
        await on_cleanup(second)


@pytest.mark.asyncio
async def test_dev_mode_without_admin_password_uses_dev_default_and_seeds_user(tmp_path, caplog) -> None:
    app = create_app(make_settings(tmp_path, mode="dev", admin_password=""))
    with caplog.at_level(logging.WARNING, logger="backend.seed"):
        await on_startup(app)
    try:
        admin = await get_user_by_username(app["db"], "admin")
        user = await get_user_by_username(app["db"], "user")
        assert admin is not None and verify_password(admin["password_hash"], "admin")
        assert user is not None and verify_password(user["password_hash"], "userpass1")
        assert user["email"] == "user@example.edu"
        assert user["email_confirmed_at"] is not None
        assert "ADMIN_PASSWORD is not set" in caplog.text
    finally:
        await on_cleanup(app)


def test_prod_refuses_to_start_without_admin_password(tmp_path) -> None:
    with pytest.raises(ValueError, match="ADMIN_PASSWORD"):
        create_app(make_settings(tmp_path, mode="prod", cookie_secret="real-secret", admin_password=""))


def test_smtp_mode_requires_smtp_settings(tmp_path) -> None:
    with pytest.raises(ValueError, match="SMTP_HOST"):
        create_app(make_settings(tmp_path, email_mode="smtp"))


def test_unknown_email_mode_is_refused(tmp_path) -> None:
    with pytest.raises(ValueError, match="EMAIL_MODE"):
        create_app(make_settings(tmp_path, email_mode="carrier-pigeon"))


def test_empty_allowed_domains_are_refused(tmp_path) -> None:
    with pytest.raises(ValueError, match="ALLOWED_EMAIL_DOMAINS"):
        create_app(make_settings(tmp_path, allowed_email_domains=()))


def test_positive_karma_floor_is_refused(tmp_path) -> None:
    with pytest.raises(ValueError, match="KARMA_FLOOR"):
        create_app(make_settings(tmp_path, karma_floor=10))


def test_parse_domains_cleans_the_list() -> None:
    assert parse_domains(" School.EDU, @uni.edu ,,school.edu") == ("school.edu", "uni.edu")


def test_load_settings_reads_gounie_env(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("APP_MODE", "test")
    monkeypatch.setenv("DB_PATH", str(tmp_path / "env.sqlite3"))
    monkeypatch.setenv("ADMIN_PASSWORD", "from-env-1")
    monkeypatch.setenv("ALLOWED_EMAIL_DOMAINS", "school.edu, uni.edu")
    monkeypatch.setenv("EMAIL_MODE", "smtp")
    monkeypatch.setenv("SMTP_HOST", "smtp-relay.brevo.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "login@example.edu")
    monkeypatch.setenv("SMTP_PASSWORD", "smtp-key")
    monkeypatch.setenv("EMAIL_FROM", "gounie <gounie@school.edu>")
    monkeypatch.setenv("KARMA_FLOOR", "-20")

    settings = load_settings()
    assert settings.admin_password == "from-env-1"
    assert settings.allowed_email_domains == ("school.edu", "uni.edu")
    assert settings.email_mode == "smtp"
    assert settings.smtp_port == 587
    assert settings.karma_floor == -20
