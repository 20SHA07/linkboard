import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * PGlite runs PostgreSQL itself in WASM. Only the Supabase-managed auth namespace
 * is stubbed here; profile grants, RLS, triggers and RPCs are the deployed SQL.
 * This does not emulate GoTrue, PostgREST or a live project's API configuration.
 */
describe('PostgreSQL authorization and validation', () => {
  let database: PGlite;
  let schema: string;
  let authorizationTests: string;

  beforeAll(async () => {
    database = new PGlite();
    [schema, authorizationTests] = await Promise.all([
      readFile(path.resolve('supabase/schema.sql'), 'utf8'),
      readFile(path.resolve('supabase/tests/rls.sql'), 'utf8'),
    ]);
    await database.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key, email text unique);
      grant usage on schema auth to anon, authenticated;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
    `);
    await database.exec(schema);
  }, 30_000);

  afterAll(async () => {
    await database?.close();
  });

  it('enforces owner isolation, anonymous permissions, safe links, and server timestamps', async () => {
    const results = await database.exec(authorizationTests);
    const last = results.at(-1)?.rows[0] as { result?: string } | undefined;
    expect(last?.result).toMatch(/^PASS: All Linkboard database authorization tests passed/);
    const fixtures = await database.query<{ count: number }>(
      'select count(*)::integer as count from auth.users',
    );
    expect(fixtures.rows[0].count).toBe(0);
  }, 15_000);

  it('can reapply the initial schema without weakening authorization', async () => {
    await database.exec(schema);
    const results = await database.exec(authorizationTests);
    const last = results.at(-1)?.rows[0] as { result?: string } | undefined;
    expect(last?.result).toMatch(/^PASS:/);
  }, 15_000);
});
