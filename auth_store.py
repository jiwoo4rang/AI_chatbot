import os
import sqlite3
import time

from werkzeug.security import check_password_hash, generate_password_hash


DB_PATH = os.getenv("APP_DB_PATH", "assembly_ai.db")
DEFAULT_ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
DEFAULT_ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin1234")
PASSWORD_HASH_METHOD = "pbkdf2:sha256"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def user_public(row):
    return {
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "role": row["role"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
    }


def init_db():
    with get_db() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              display_name TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'user',
              is_active INTEGER NOT NULL DEFAULT 1,
              created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS conversations (
              id TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              title TEXT NOT NULL,
              messages TEXT NOT NULL DEFAULT '[]',
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS uploaded_files (
              id TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              original_name TEXT NOT NULL,
              stored_name TEXT NOT NULL,
              content_type TEXT,
              text_content TEXT NOT NULL DEFAULT '',
              created_at INTEGER NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )

        existing = db.execute("SELECT id FROM users WHERE username = ?", (DEFAULT_ADMIN_USERNAME,)).fetchone()
        if not existing:
            now = int(time.time() * 1000)
            db.execute(
                """
                INSERT INTO users (username, password_hash, display_name, role, is_active, created_at)
                VALUES (?, ?, ?, 'admin', 1, ?)
                """,
                (
                    DEFAULT_ADMIN_USERNAME,
                    generate_password_hash(DEFAULT_ADMIN_PASSWORD, method=PASSWORD_HASH_METHOD),
                    "관리자",
                    now,
                ),
            )


def find_user_by_username(username):
    with get_db() as db:
        return db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()


def find_user_by_id(user_id):
    with get_db() as db:
        return db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def verify_user(username, password):
    row = find_user_by_username(username)
    if not row or not row["is_active"]:
        return None
    if not check_password_hash(row["password_hash"], password):
        return None
    return user_public(row)


def list_users():
    with get_db() as db:
        rows = db.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
        return [user_public(row) for row in rows]


def create_user(username, password, display_name, role="user"):
    now = int(time.time() * 1000)
    with get_db() as db:
        cursor = db.execute(
            """
            INSERT INTO users (username, password_hash, display_name, role, is_active, created_at)
            VALUES (?, ?, ?, ?, 1, ?)
            """,
            (
                username,
                generate_password_hash(password, method=PASSWORD_HASH_METHOD),
                display_name or username,
                role if role in ("admin", "user") else "user",
                now,
            ),
        )
        row = db.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return user_public(row)


def update_user(user_id, display_name=None, role=None, is_active=None, password=None):
    updates = []
    params = []

    if display_name is not None:
        updates.append("display_name = ?")
        params.append(display_name)
    if role in ("admin", "user"):
        updates.append("role = ?")
        params.append(role)
    if is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if is_active else 0)
    if password:
        updates.append("password_hash = ?")
        params.append(generate_password_hash(password, method=PASSWORD_HASH_METHOD))

    if not updates:
        return find_user_by_id(user_id)

    params.append(user_id)
    with get_db() as db:
        db.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
        return db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def delete_user(user_id):
    with get_db() as db:
        db.execute("DELETE FROM conversations WHERE user_id = ?", (user_id,))
        db.execute("DELETE FROM uploaded_files WHERE user_id = ?", (user_id,))
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))


def list_conversations(user_id):
    with get_db() as db:
        rows = db.execute(
            """
            SELECT id, title, messages, created_at AS createdAt, updated_at AS updatedAt
            FROM conversations
            WHERE user_id = ?
            ORDER BY updated_at DESC
            """,
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]


def upsert_conversation(user_id, conversation):
    now = int(time.time() * 1000)
    conversation_id = conversation["id"]
    title = conversation.get("title") or "새 대화"
    messages = conversation.get("messages") or "[]"
    updated_at = int(conversation.get("updatedAt") or now)
    created_at = int(conversation.get("createdAt") or updated_at)

    with get_db() as db:
        db.execute(
            """
            INSERT INTO conversations (id, user_id, title, messages, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              messages = excluded.messages,
              updated_at = excluded.updated_at
            """,
            (conversation_id, user_id, title, messages, created_at, updated_at),
        )


def delete_conversation(user_id, conversation_id):
    with get_db() as db:
        db.execute("DELETE FROM conversations WHERE user_id = ? AND id = ?", (user_id, conversation_id))


def save_uploaded_file(file_record):
    now = int(time.time() * 1000)
    with get_db() as db:
        db.execute(
            """
            INSERT INTO uploaded_files (id, user_id, original_name, stored_name, content_type, text_content, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                file_record["id"],
                file_record["user_id"],
                file_record["original_name"],
                file_record["stored_name"],
                file_record.get("content_type") or "",
                file_record.get("text_content") or "",
                now,
            ),
        )


def get_uploaded_file(user_id, file_id):
    with get_db() as db:
        return db.execute(
            "SELECT * FROM uploaded_files WHERE user_id = ? AND id = ?",
            (user_id, file_id),
        ).fetchone()


def list_uploaded_files_by_ids(user_id, file_ids):
    if not file_ids:
        return []
    placeholders = ",".join("?" for _ in file_ids)
    with get_db() as db:
        return db.execute(
            f"SELECT * FROM uploaded_files WHERE user_id = ? AND id IN ({placeholders})",
            [user_id, *file_ids],
        ).fetchall()
