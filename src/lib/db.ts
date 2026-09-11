import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type DbUser = {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

const globalForDb = globalThis as unknown as {
  __paginaDb?: Database.Database;
};

function resolveDbPath(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) {
    if (fromEnv.startsWith("file:")) {
      return fromEnv.slice("file:".length);
    }
    return fromEnv;
  }
  return path.join(process.cwd(), "data", "pagina.sqlite");
}

function openDb(): Database.Database {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
  `);
  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.__paginaDb) {
    globalForDb.__paginaDb = openDb();
  }
  return globalForDb.__paginaDb;
}
