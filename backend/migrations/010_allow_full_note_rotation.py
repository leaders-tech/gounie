"""Let wall notes turn all the way around: tilt can now be anything from -180 to 180 degrees.

SQLite can't change a CHECK rule in place, so this migration copies wall_notes into a new table with the new rule.
Edit this file only if this migration has not been used yet.
Create a new migration file instead when you need another schema change.
"""

from yoyo import step


def rebuild_wall_notes(conn, max_tilt: int) -> None:
    cursor = conn.cursor()
    cursor.execute(
        f"""
        CREATE TABLE wall_notes_new (
            id INTEGER PRIMARY KEY,
            wall_user_id INTEGER NOT NULL,
            author_id INTEGER NOT NULL,
            text TEXT NOT NULL DEFAULT '',
            image BLOB,
            color TEXT NOT NULL,
            text_color TEXT NOT NULL DEFAULT '#1c1917',
            tilt INTEGER NOT NULL CHECK (tilt BETWEEN -{max_tilt} AND {max_tilt}),
            bold INTEGER NOT NULL DEFAULT 0 CHECK (bold IN (0, 1)),
            italic INTEGER NOT NULL DEFAULT 0 CHECK (italic IN (0, 1)),
            underline INTEGER NOT NULL DEFAULT 0 CHECK (underline IN (0, 1)),
            strikethrough INTEGER NOT NULL DEFAULT 0 CHECK (strikethrough IN (0, 1)),
            created_at TEXT NOT NULL,
            FOREIGN KEY (wall_user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
        ) STRICT
        """
    )
    cursor.execute(
        f"""
        INSERT INTO wall_notes_new (
            id, wall_user_id, author_id, text, image, color, text_color, tilt, bold, italic, underline, strikethrough, created_at
        )
        SELECT id, wall_user_id, author_id, text, image, color, text_color,
               MAX(-{max_tilt}, MIN({max_tilt}, tilt)), bold, italic, underline, strikethrough, created_at
        FROM wall_notes
        """
    )
    cursor.execute("DROP TABLE wall_notes")
    cursor.execute("ALTER TABLE wall_notes_new RENAME TO wall_notes")
    cursor.execute("CREATE INDEX wall_notes_wall ON wall_notes (wall_user_id, id)")


def allow_full_rotation(conn) -> None:
    rebuild_wall_notes(conn, 180)


def go_back_to_small_tilt(conn) -> None:
    rebuild_wall_notes(conn, 15)


steps = [step(allow_full_rotation, go_back_to_small_tilt)]
