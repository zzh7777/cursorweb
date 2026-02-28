import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'cursorweb.db');

import fs from 'fs';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
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
`);

const stmts = {
  createConversation: db.prepare(
    'INSERT INTO conversations (id, title) VALUES (?, ?)'
  ),
  getConversations: db.prepare(
    'SELECT * FROM conversations ORDER BY updated_at DESC'
  ),
  getConversation: db.prepare(
    'SELECT * FROM conversations WHERE id = ?'
  ),
  updateConversationTitle: db.prepare(
    `UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?`
  ),
  touchConversation: db.prepare(
    `UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`
  ),
  deleteConversation: db.prepare(
    'DELETE FROM conversations WHERE id = ?'
  ),
  addMessage: db.prepare(
    'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
  ),
  getMessages: db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ),
};

export function createConversation(id, title = 'New Chat') {
  stmts.createConversation.run(id, title);
  return stmts.getConversation.get(id);
}

export function getConversations() {
  return stmts.getConversations.all();
}

export function getConversation(id) {
  return stmts.getConversation.get(id);
}

export function updateConversationTitle(id, title) {
  stmts.updateConversationTitle.run(title, id);
}

export function deleteConversation(id) {
  stmts.deleteConversation.run(id);
}

export function addMessage(conversationId, role, content) {
  stmts.touchConversation.run(conversationId);
  const info = stmts.addMessage.run(conversationId, role, content);
  return { id: info.lastInsertRowid, conversationId, role, content };
}

export function getMessages(conversationId) {
  return stmts.getMessages.all(conversationId);
}

export default db;
