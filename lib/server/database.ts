import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

if (typeof window !== 'undefined') throw new Error('The database can only run on the server.');

const registry = globalThis as typeof globalThis & {
  linkboardDatabases?: Map<string, DatabaseSync>;
};
const databases = (registry.linkboardDatabases ??= new Map());

export function databasePath(): string {
  // This is mutable runtime storage, never an input to the application bundle.
  return resolve(
    /* turbopackIgnore: true */ process.env.LINKBOARD_DATABASE_PATH || 'data/linkboard.sqlite',
  );
}

/** Reuse connections across Next.js development reloads; all requests use disk data. */
export function getDatabase(filename = databasePath()): DatabaseSync {
  const path = resolve(/* turbopackIgnore: true */ filename);
  const cached = databases.get(path);
  if (cached) return cached;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(path);
  try {
    chmodSync(path, 0o600);
    database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        username TEXT NOT NULL UNIQUE,
        document TEXT NOT NULL CHECK(json_valid(document))
      ) STRICT;
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS click_events (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        link_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS clicks_profile_time
        ON click_events(profile_id, occurred_at, id);
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS limits_expiry ON rate_limits(expires_at);
      PRAGMA user_version = 1;
    `);
    databases.set(path, database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

/** Allows graceful operator shutdown and isolated tests to release their own file. */
export function closeDatabase(filename: string): void {
  const path = resolve(/* turbopackIgnore: true */ filename);
  databases.get(path)?.close();
  databases.delete(path);
}

export function transaction<T>(database: DatabaseSync, action: () => T): T {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
