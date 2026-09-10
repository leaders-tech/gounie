"""Create the wall_notes table for sticky notes on user walls.

Edit this file only if this migration has not been used yet.
Create a new migration file instead when you need another schema change.
"""

from yoyo import step


steps = [
    step(
        """
        CREATE TABLE wall_notes (
            id INTEGER PRIMARY KEY,
            wall_user_id INTEGER NOT NULL,
            author_id INTEGER NOT NULL,
            text TEXT NOT NULL DEFAULT '',
            image BLOB,
            color TEXT NOT NULL,
            tilt INTEGER NOT NULL CHECK (tilt BETWEEN -15 AND 15),
            created_at TEXT NOT NULL,
            FOREIGN KEY (wall_user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
        ) STRICT
        """,
        "DROP TABLE wall_notes",
    ),
    step(
        "CREATE INDEX wall_notes_wall ON wall_notes (wall_user_id, id)",
        "DROP INDEX wall_notes_wall",
    ),
]
