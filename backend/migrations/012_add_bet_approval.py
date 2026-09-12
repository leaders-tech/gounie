"""Add admin approval to bets: new bets wait for an admin before they are published.

Bets that already existed stay published, so old bets do not disappear.
Edit this file only if this migration has not been used yet.
Create a new migration file instead when you need another schema change.
"""

from yoyo import step


steps = [
    step(
        "ALTER TABLE bets ADD COLUMN approval TEXT NOT NULL DEFAULT 'pending' CHECK (approval IN ('pending', 'approved', 'declined'))",
        "ALTER TABLE bets DROP COLUMN approval",
    ),
    step(
        "ALTER TABLE bets ADD COLUMN reviewed_by INTEGER REFERENCES users (id) ON DELETE SET NULL",
        "ALTER TABLE bets DROP COLUMN reviewed_by",
    ),
    step(
        "ALTER TABLE bets ADD COLUMN reviewed_at TEXT",
        "ALTER TABLE bets DROP COLUMN reviewed_at",
    ),
    step(
        "ALTER TABLE bets ADD COLUMN review_note TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE bets DROP COLUMN review_note",
    ),
    step("UPDATE bets SET approval = 'approved'"),
    step(
        "CREATE INDEX bets_approval ON bets (approval, id)",
        "DROP INDEX bets_approval",
    ),
]
