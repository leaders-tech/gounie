"""Rename rep to karma in the database: users.rep, users.rep_risk_at, and the rep_changes table.

The data stays the same; only the names change.
Edit this file only if this migration has not been used yet.
Create a new migration file instead when you need another schema change.
"""

from yoyo import step


steps = [
    step(
        "ALTER TABLE users RENAME COLUMN rep TO karma",
        "ALTER TABLE users RENAME COLUMN karma TO rep",
    ),
    step(
        "ALTER TABLE users RENAME COLUMN rep_risk_at TO karma_risk_at",
        "ALTER TABLE users RENAME COLUMN karma_risk_at TO rep_risk_at",
    ),
    step(
        "ALTER TABLE rep_changes RENAME TO karma_changes",
        "ALTER TABLE karma_changes RENAME TO rep_changes",
    ),
    step(
        "ALTER TABLE karma_changes RENAME COLUMN rep_after TO karma_after",
        "ALTER TABLE karma_changes RENAME COLUMN karma_after TO rep_after",
    ),
    step(
        "DROP INDEX rep_changes_user",
        "CREATE INDEX rep_changes_user ON karma_changes (user_id, id)",
    ),
    step(
        "CREATE INDEX karma_changes_user ON karma_changes (user_id, id)",
        "DROP INDEX karma_changes_user",
    ),
]
