import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// A small D1-compatible adapter keeps the local app and the Worker on the same SQL.
export function openDatabase(filename = ':memory:') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY)');
  const migrations=new URL('../migrations/',import.meta.url);
  for(const file of readdirSync(migrations).filter(name=>name.endsWith('.sql')).sort()) {
    const name=file.replace(/\.sql$/,'');
    if(sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(name))continue;
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      sqlite.exec(readFileSync(new URL(file,migrations), 'utf8'));
      sqlite.prepare('INSERT INTO local_migrations(name) VALUES(?)').run(name);
      sqlite.exec('COMMIT');
    } catch(error) { sqlite.exec('ROLLBACK'); throw error; }
  }
  function statement(sql, args = []) {
    return {
      bind(...values) { return statement(sql, values); },
      async first() { return sqlite.prepare(sql).get(...args) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...args), success: true }; },
      async run() { const r = sqlite.prepare(sql).run(...args); return { success:true, meta:{ changes:Number(r.changes) } }; },
      _run() { const r = sqlite.prepare(sql).run(...args); return { success:true, meta:{ changes:Number(r.changes) } }; }
    };
  }
  return {
    prepare: statement,
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try { const result = statements.map(s => s._run()); sqlite.exec('COMMIT'); return result; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close() { sqlite.close(); }
  };
}
