import json
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
                cli_session_id TEXT,
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
            CREATE TABLE IF NOT EXISTS rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                sql_code TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT '',
                enabled INTEGER NOT NULL DEFAULT 1,
                conversation_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)
        try:
            conn.execute("ALTER TABLE conversations ADD COLUMN cli_session_id TEXT")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE messages ADD COLUMN images TEXT")
        except Exception:
            pass

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


def set_cli_session_id(id: str, cli_session_id: str):
    with _get_conn() as conn:
        conn.execute(
            "UPDATE conversations SET cli_session_id = ? WHERE id = ?",
            (cli_session_id, id),
        )


def get_cli_session_id(id: str) -> str | None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT cli_session_id FROM conversations WHERE id = ?", (id,)
        ).fetchone()
    if row:
        return row["cli_session_id"]
    return None


def delete_conversation(id: str):
    with _get_conn() as conn:
        conn.execute("DELETE FROM conversations WHERE id = ?", (id,))


def add_message(conversation_id: str, role: str, content: str, images: list[str] | None = None) -> dict:
    images_json = json.dumps(images) if images else None
    with _get_conn() as conn:
        conn.execute(
            "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?",
            (conversation_id,),
        )
        cur = conn.execute(
            "INSERT INTO messages (conversation_id, role, content, images) VALUES (?, ?, ?, ?)",
            (conversation_id, role, content, images_json),
        )
    return {"id": cur.lastrowid, "conversation_id": conversation_id, "role": role, "content": content, "images": images}


def get_messages(conversation_id: str) -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conversation_id,),
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        raw = d.get("images")
        d["images"] = json.loads(raw) if raw else None
        result.append(d)
    return result


# ---------- Rules ----------

def create_rule(id: str, name: str, sql_code: str, description: str = "",
                category: str = "", conversation_id: str | None = None) -> dict:
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO rules (id, name, description, sql_code, category, conversation_id) VALUES (?, ?, ?, ?, ?, ?)",
            (id, name, description, sql_code, category, conversation_id),
        )
        row = conn.execute("SELECT * FROM rules WHERE id = ?", (id,)).fetchone()
    return _row_to_dict(row)


def get_rules(enabled_only: bool = False) -> list[dict]:
    with _get_conn() as conn:
        if enabled_only:
            rows = conn.execute("SELECT * FROM rules WHERE enabled = 1 ORDER BY updated_at DESC").fetchall()
        else:
            rows = conn.execute("SELECT * FROM rules ORDER BY updated_at DESC").fetchall()
    return [dict(r) for r in rows]


def get_rule(id: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM rules WHERE id = ?", (id,)).fetchone()
    return _row_to_dict(row)


def update_rule(id: str, **fields) -> dict | None:
    allowed = {"name", "description", "sql_code", "category", "enabled"}
    updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not updates:
        return get_rule(id)
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values())
    values.append(id)
    with _get_conn() as conn:
        conn.execute(
            f"UPDATE rules SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
            values,
        )
        row = conn.execute("SELECT * FROM rules WHERE id = ?", (id,)).fetchone()
    return _row_to_dict(row)


def delete_rule(id: str):
    with _get_conn() as conn:
        conn.execute("DELETE FROM rules WHERE id = ?", (id,))
