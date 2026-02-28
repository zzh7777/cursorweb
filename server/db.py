import sqlite3
import os
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "cursorweb.db"

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def _init_db():
    with _get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'New Chat',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );
        """)

_init_db()


def _row_to_dict(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    return dict(row)


def create_conversation(id: str, title: str = "New Chat") -> dict:
    with _get_conn() as conn:
        conn.execute("INSERT INTO conversations (id, title) VALUES (?, ?)", (id, title))
        row = conn.execute("SELECT * FROM conversations WHERE id = ?", (id,)).fetchone()
    return _row_to_dict(row)


def get_conversations() -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute("SELECT * FROM conversations ORDER BY updated_at DESC").fetchall()
    return [dict(r) for r in rows]


def get_conversation(id: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM conversations WHERE id = ?", (id,)).fetchone()
    return _row_to_dict(row)


def update_conversation_title(id: str, title: str):
    with _get_conn() as conn:
        conn.execute(
            "UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?",
            (title, id),
        )


def delete_conversation(id: str):
    with _get_conn() as conn:
        conn.execute("DELETE FROM conversations WHERE id = ?", (id,))


def add_message(conversation_id: str, role: str, content: str) -> dict:
    with _get_conn() as conn:
        conn.execute(
            "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?",
            (conversation_id,),
        )
        cur = conn.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
            (conversation_id, role, content),
        )
    return {"id": cur.lastrowid, "conversation_id": conversation_id, "role": role, "content": content}


def get_messages(conversation_id: str) -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conversation_id,),
        ).fetchall()
    return [dict(r) for r in rows]
