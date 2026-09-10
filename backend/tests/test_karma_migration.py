"""Test migration 011: an existing database keeps every user's points and history after rep is renamed to karma.

Edit this file when migration 011 or the karma columns change.
Copy a test pattern here when you add another migration that renames columns or tables.
"""

from __future__ import annotations

import sqlite3

from yoyo import get_backend, read_migrations

from backend.config import ROOT_DIR
from backend.db.migrations import run_migrations
from backend.db.sqlite_time import sqlite_datetime_codecs

MIGRATIONS_DIR = ROOT_DIR / "backend" / "migrations"


def test_rename_keeps_points_timer_and_history(tmp_path) -> None:
    db_path = tmp_path / "before_karma.sqlite3"
    old_migrations = read_migrations(str(MIGRATIONS_DIR)).filter(lambda migration: migration.id < "011")
    with sqlite_datetime_codecs():
        backend = get_backend(f"sqlite:///{db_path}")
        try:
            with backend.lock():
                backend.apply_migrations(backend.to_apply(old_migrations))
        finally:
            backend.connection.close()

    connection = sqlite3.connect(db_path)
    connection.execute(
        "INSERT INTO users (username, password_hash, rep, rep_risk_at, created_at, updated_at) VALUES ('old', 'x', -12, '2026-09-01T10:00:00+00:00', 'now', 'now')"
    )
    connection.execute("INSERT INTO rep_changes (user_id, delta, rep_after, reason, created_at) VALUES (1, -12, -12, 'slots_stake', 'now')")
    connection.commit()
    connection.close()

    run_migrations(db_path, MIGRATIONS_DIR)

    connection = sqlite3.connect(db_path)
    try:
        assert connection.execute("SELECT karma, karma_risk_at FROM users WHERE username = 'old'").fetchone() == (-12, "2026-09-01T10:00:00+00:00")
        assert connection.execute("SELECT delta, karma_after, reason FROM karma_changes").fetchone() == (-12, -12, "slots_stake")

        user_columns = {row[1] for row in connection.execute("PRAGMA table_info(users)")}
        assert {"karma", "karma_risk_at"} <= user_columns
        assert not {"rep", "rep_risk_at"} & user_columns

        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert "karma_changes" in tables
        assert "rep_changes" not in tables

        indexes = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'index'")}
        assert "karma_changes_user" in indexes
        assert "rep_changes_user" not in indexes
    finally:
        connection.close()
