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

  it('can apply the narrow URL migration repeatedly without weakening authorization', async () => {
    const migration = await readFile(
      path.resolve('supabase/migrations/202609130001_allow_fully_qualified_hosts.sql'),
      'utf8',
    );
    await database.exec(migration);
    await database.exec(migration);
    const results = await database.exec(authorizationTests);
    const last = results.at(-1)?.rows[0] as { result?: string } | undefined;
    expect(last?.result).toMatch(/^PASS:/);
  });

  it.each([
    'javascript:alert(1)',
    'https://user:password@example.com./',
    'https://example.com.:65536/path',
    'https://example.com.\\@attacker.example/',
    'https://[not-an-ip]/',
    'https://%65xample.com./',
    'https://example.com./a b',
  ])('still rejects an unsafe or malformed URL in SQL: %s', async (url) => {
    const result = await database.query<{ valid: boolean }>(
      'select private.linkboard_safe_url($1) as valid',
      [url],
    );
    expect(result.rows[0]?.valid).toBe(false);
  });

  it('saves valid fully qualified domain URLs, including HTTPS avatars', async () => {
    const ownerId = 'c3333333-3333-4333-8333-333333333333';
    await database.exec('begin');
    try {
      await database.query('insert into auth.users (id, email) values ($1, $2)', [
        ownerId,
        'linkboard-url-test@example.invalid',
      ]);
      await database.exec('set local role authenticated');
      await database.query("select set_config('request.jwt.claim.sub', $1, true)", [ownerId]);
      for (const destination of [
        'https://example.com./portfolio',
        'https://subdomain.example.com.:8443/avatar.png',
      ]) {
        const url = new URL(destination).href;
        const result = await database.query<{ avatar_url: string }>(
          'update public.profiles set avatar_url = $1, links = $2 where id = $3 returning avatar_url',
          [
            url,
            JSON.stringify([
              { id: 'website', title: 'Website', url, platform: 'website', enabled: true },
            ]),
            ownerId,
          ],
        );
        expect(result.rows[0]?.avatar_url).toBe(url);
      }
    } finally {
      await database.exec('rollback');
    }
  });
});
