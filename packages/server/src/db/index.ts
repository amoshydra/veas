import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema.js";

const DB_PATH = "./data/veas.db";

mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '__UNNAMED__',
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
    pipeline_id TEXT,
    node_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS node_graphs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '__UNNAMED__',
    nodes TEXT NOT NULL DEFAULT '[]',
    connections TEXT NOT NULL DEFAULT '[]',
    viewport TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function addColumnIfNotExists(table: string, column: string, type: string) {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

try {
  addColumnIfNotExists("jobs", "pipeline_id", "TEXT");
  addColumnIfNotExists("jobs", "node_id", "TEXT");
} catch {
  // Table might not exist yet, ignore
}

export const db = drizzle(sqlite, { schema });
