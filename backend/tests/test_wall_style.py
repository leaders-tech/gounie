"""Test the look of wall notes: custom colors and text styles, full rotation, rotate-only editing, and migrations 009-010.

Edit this file when note colors, text styles, rotation, the rotate endpoint, or wall note migrations change.
Copy a test pattern here when you add tests for another editable field or another data-changing migration.
"""

from __future__ import annotations

import logging
import sqlite3

import pytest
from yoyo import get_backend, read_migrations

from backend.config import ROOT_DIR
from backend.db.migrations import run_migrations
from backend.db.sqlite_time import sqlite_datetime_codecs
from backend.tests.conftest import api, login_as

MIGRATIONS_DIR = ROOT_DIR / "backend" / "migrations"
CUSTOM_STYLE = {"color": "#FF00AA", "text_color": "#0000ff", "tilt": -7, "bold": True, "italic": False, "underline": True, "strikethrough": True}


@pytest.fixture
async def people(client, create_user):
    ids = {name: await create_user(name) for name in ("alice", "bob")}
    cookies = {name: await login_as(client, name) for name in ids}
    return ids, cookies


async def post_note(client, cookies, **style) -> dict:
    body = {"username": "alice", "text": "styled note", "tilt": 0} | style
    status, payload = await api(client, "/api/wall/post", body, cookies)
    assert status == 200, payload
    return payload["data"]["note"]


@pytest.mark.asyncio
async def test_post_saves_custom_colors_and_text_styles(client, people) -> None:
    _, cookies = people
    note = await post_note(client, cookies["bob"], **CUSTOM_STYLE)
    assert note["color"] == "#ff00aa"
    assert note["text_color"] == "#0000ff"
    assert note["tilt"] == -7
    assert (note["bold"], note["italic"], note["underline"], note["strikethrough"]) == (True, False, True, True)

    _, payload = await api(client, "/api/wall/list", {"username": "alice"}, cookies["alice"])
    assert payload["data"]["notes"][0] == note


@pytest.mark.asyncio
async def test_post_uses_the_default_look_when_nothing_is_chosen(client, people) -> None:
    _, cookies = people
    note = await post_note(client, cookies["bob"])
    assert note["color"] == "#fef08a"
    assert note["text_color"] == "#1c1917"
    assert not any(note[flag] for flag in ("bold", "italic", "underline", "strikethrough"))


@pytest.mark.asyncio
@pytest.mark.parametrize("tilt", [-180, 135, 180])
async def test_notes_can_turn_all_the_way_around(client, people, tilt) -> None:
    _, cookies = people
    note = await post_note(client, cookies["bob"], tilt=tilt)
    assert note["tilt"] == tilt


@pytest.mark.asyncio
async def test_author_can_rotate_a_note_but_nothing_else_changes(client, people, caplog) -> None:
    _, cookies = people
    note = await post_note(client, cookies["bob"], text="keep this text", **CUSTOM_STYLE)
    body = {"id": note["id"], "tilt": 170, "color": "#000000", "text_color": "#ffffff", "bold": False, "text": "changed?"}

    with caplog.at_level(logging.INFO, logger="backend.wall"):
        status, payload = await api(client, "/api/wall/rotate", body, cookies["bob"])
    assert status == 200
    updated = payload["data"]["note"]
    assert updated["tilt"] == 170
    assert (updated["text"], updated["color"], updated["text_color"], updated["bold"]) == ("keep this text", "#ff00aa", "#0000ff", True)
    assert "Wall note rotated" in caplog.text

    _, payload = await api(client, "/api/wall/list", {"username": "alice"}, cookies["alice"])
    assert payload["data"]["notes"][0]["tilt"] == 170


@pytest.mark.asyncio
async def test_only_the_author_can_rotate(client, people) -> None:
    _, cookies = people
    note = await post_note(client, cookies["bob"])
    body = {"id": note["id"], "tilt": 90}

    status, payload = await api(client, "/api/wall/rotate", body, cookies["alice"])
    assert status == 403
    assert payload["error"]["code"] == "not_allowed"
    assert (await api(client, "/api/wall/rotate", {"id": 9999, "tilt": 90}, cookies["bob"]))[0] == 404
    assert (await api(client, "/api/wall/rotate", body))[0] == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("overrides", [{"tilt": 181}, {"tilt": -181}, {"tilt": "90"}, {"tilt": None}, {"id": "1"}])
async def test_rotate_rejects_bad_input(client, people, overrides) -> None:
    _, cookies = people
    note = await post_note(client, cookies["bob"])
    body = {"id": note["id"], "tilt": 0} | overrides
    status, _ = await api(client, "/api/wall/rotate", body, cookies["bob"])
    assert status == 400


@pytest.mark.asyncio
async def test_there_is_no_endpoint_to_change_anything_else(client, people) -> None:
    _, cookies = people
    note = await post_note(client, cookies["bob"])
    status, _ = await api(client, "/api/wall/update-style", {"id": note["id"], "tilt": 0, "color": "#000000"}, cookies["bob"])
    assert status == 404


def test_migrations_convert_old_colors_and_allow_full_rotation(tmp_path) -> None:
    db_path = tmp_path / "old.sqlite3"
    old_migrations = read_migrations(str(MIGRATIONS_DIR)).filter(lambda migration: migration.id < "009")
    with sqlite_datetime_codecs():
        backend = get_backend(f"sqlite:///{db_path}")
        try:
            with backend.lock():
                backend.apply_migrations(backend.to_apply(old_migrations))
        finally:
            backend.connection.close()

    connection = sqlite3.connect(db_path)
    connection.execute("INSERT INTO users (username, password_hash, created_at, updated_at) VALUES ('old', 'x', 'now', 'now')")
    connection.execute("INSERT INTO wall_notes (wall_user_id, author_id, text, color, tilt, created_at) VALUES (1, 1, 'hi', 'pink', 2, 'now')")
    connection.commit()
    connection.close()

    run_migrations(db_path, MIGRATIONS_DIR)

    connection = sqlite3.connect(db_path)
    try:
        row = connection.execute("SELECT text, color, text_color, tilt, bold, italic, underline, strikethrough FROM wall_notes").fetchone()
        assert row == ("hi", "#fbcfe8", "#1c1917", 2, 0, 0, 0, 0)
        connection.execute("UPDATE wall_notes SET tilt = 170")
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("UPDATE wall_notes SET tilt = 181")
        index = connection.execute("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'wall_notes_wall'").fetchone()
        assert index is not None
    finally:
        connection.close()
