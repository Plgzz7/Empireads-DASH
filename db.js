// ---------- BANCO DE DADOS (SQLite embutido do Node, sem dependências externas) ----------
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'empireads.db'));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    email TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    logged_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_comments_client ON comments(client_name);
  CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id);
`);

// ---------- Helpers de senha (scrypt, padrão seguro do Node) ----------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Usuários ----------
const insertUserStmt = db.prepare(
  'INSERT INTO users (name, email, password_hash, salt) VALUES (?, ?, ?, ?)'
);
const findUserByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ?');

function createUser(name, email, password) {
  const { hash, salt } = hashPassword(password);
  try {
    const info = insertUserStmt.run(name.trim(), email.trim().toLowerCase(), hash, salt);
    return { id: Number(info.lastInsertRowid), name: name.trim(), email: email.trim().toLowerCase() };
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return null; // e-mail já existe
    throw err;
  }
}

function authenticate(email, password) {
  const user = findUserByEmailStmt.get(String(email).trim().toLowerCase());
  if (!user) return null;
  if (!verifyPassword(password, user.salt, user.password_hash)) return null;
  return { id: user.id, name: user.name, email: user.email };
}

// ---------- Sessões ----------
const insertSessionStmt = db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)');
const findSessionStmt = db.prepare(`
  SELECT s.token, u.id, u.name, u.email FROM sessions s
  JOIN users u ON u.id = s.user_id
  WHERE s.token = ? AND s.created_at >= datetime('now', '-7 days')
`);
const deleteSessionStmt = db.prepare('DELETE FROM sessions WHERE token = ?');

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  insertSessionStmt.run(token, userId);
  return token;
}

function getSessionUser(token) {
  if (!token) return null;
  return findSessionStmt.get(token) || null;
}

function destroySession(token) {
  if (token) deleteSessionStmt.run(token);
}

// ---------- Logs de login ----------
const insertLoginLogStmt = db.prepare(
  'INSERT INTO login_logs (user_id, user_name, email, ip, user_agent) VALUES (?, ?, ?, ?, ?)'
);

function logLogin(user, ip, userAgent) {
  insertLoginLogStmt.run(user.id, user.name, user.email, ip || null, userAgent || null);
}

// ---------- Comentários ----------
const insertCommentStmt = db.prepare(
  'INSERT INTO comments (client_name, author, text, user_id) VALUES (?, ?, ?, ?)'
);
const listCommentsStmt = db.prepare(
  'SELECT author, text, created_at AS date FROM comments WHERE client_name = ? ORDER BY id ASC'
);

function addComment(clientName, author, text, userId) {
  insertCommentStmt.run(clientName, author || 'Anônimo', text, userId || null);
  return listComments(clientName);
}

function listComments(clientName) {
  return listCommentsStmt.all(clientName).map((row) => ({
    author: row.author,
    text: row.text,
    date: row.date.includes('T') ? row.date : row.date.replace(' ', 'T') + 'Z',
  }));
}

// ---------- Usuário admin padrão (criado na primeira execução) ----------
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@empireads.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'empire2026';
if (!findUserByEmailStmt.get(ADMIN_EMAIL)) {
  createUser('Administrador', ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log(`Usuário admin criado: ${ADMIN_EMAIL}`);
}

module.exports = {
  createUser,
  authenticate,
  createSession,
  getSessionUser,
  destroySession,
  logLogin,
  addComment,
  listComments,
};
