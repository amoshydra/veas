import { sqlite } from "./index.js";

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Untitled',
    state TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT DEFAULT '',
    duration REAL,
    width INTEGER,
    height INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,
    params TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued',
    progress REAL NOT NULL DEFAULT 0,
    input_files TEXT NOT NULL DEFAULT '[]',
    output_file TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );
`);

console.log("Database migrations complete.");
sqlite.close();
