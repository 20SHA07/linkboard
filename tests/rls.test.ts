import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  appearanceBooleans,
  appearanceColors,
  appearanceEnums,
  appearanceNumbers,
} from '../lib/appearance-options';
import type { ProfileAppearance } from '../lib/types';

const customizedAppearance = {
  backgroundImageUrl: 'https://example.com/background.webp',
  backgroundPosition: 'bottom',
  backgroundOverlay: 35,
  avatarPosition: 'top',
  dashboardBackground: false,
  backgroundFit: 'contain',
  backgroundGradientColor: '#Ab12CD',
  backgroundGradientAngle: 225,
  textColor: '#122334',
  headingColor: '#FFFFFF',
  linkTextColor: '#223344',
  linkBackgroundColor: '#FFEEDD',
  linkBorderColor: '#556677',
  avatarBorderColor: '#000000',
  fontFamily: 'manrope',
  headingFontFamily: 'serif',
  headingWeight: 800,
  headingSize: 56,
  bioSize: 24,
  linkFontSize: 18,
  avatarSize: 200,
  avatarShape: 'rounded',
  avatarBorderWidth: 8,
  textAlign: 'right',
  linkAlign: 'center',
  linkStyle: 'glass',
  linkShadow: 'bold',
  linkRadius: 32,
  linkBorderWidth: 4,
  linkGap: 32,
  linkPadding: 28,
  contentWidth: 720,
  contentPadding: 96,
  showAvatar: true,
  showBranding: false,
  showQrCode: false,
  showLinkIcons: false,
  showLinkArrows: false,
} satisfies ProfileAppearance;

/**
 * PGlite runs PostgreSQL itself in WASM. Supabase-managed auth and Storage table
 * shells/helpers are stubbed here; grants, RLS, triggers and RPCs are deployed SQL.
 * This does not emulate GoTrue, Storage byte/MIME checks, or PostgREST.
 */
describe('PostgreSQL authorization and validation', () => {
  let database: PGlite;
  let schema: string;
  let authorizationTests: string;
  let customizationMigration: string;

  beforeAll(async () => {
    database = new PGlite();
    [schema, authorizationTests, customizationMigration] = await Promise.all([
      readFile(path.resolve('supabase/schema.sql'), 'utf8'),
      readFile(path.resolve('supabase/tests/rls.sql'), 'utf8'),
      readFile(path.resolve('supabase/migrations/202609210001_profile_customization.sql'), 'utf8'),
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
      create schema storage;
      create table storage.buckets (
        id text primary key, name text not null, public boolean not null default false,
        file_size_limit bigint, allowed_mime_types text[]
      );
      create table storage.objects (
        id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
        name text not null, metadata jsonb, owner_id text, unique (bucket_id, name)
      );
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
      create function storage.allow_any_operation(operations text[]) returns boolean language sql stable as $$
        select coalesce(replace(current_setting('storage.operation', true), 'storage.', '') = any(operations), false);
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

  it('can apply the image migration repeatedly and retains private bucket restrictions', async () => {
    const migration = await readFile(
      path.resolve('supabase/migrations/202609130002_profile_images.sql'),
      'utf8',
    );
    await database.exec(migration);
    await database.exec(migration);
    // A historical migration replaces the validator with its historical version.
    // Finish the actual upgrade sequence before checking the current contract.
    await database.exec(customizationMigration);
    const bucket = await database.query<{
      public: boolean;
      file_size_limit: number;
      allowed_mime_types: string[];
    }>('select public, file_size_limit, allowed_mime_types from storage.buckets where id = $1', [
      'linkboard-images',
    ]);
    expect(bucket.rows[0]).toEqual({
      public: false,
      file_size_limit: 2097152,
      allowed_mime_types: ['image/webp'],
    });
    const results = await database.exec(authorizationTests);
    const last = results.at(-1)?.rows[0] as { result?: string } | undefined;
    expect(last?.result).toMatch(/^PASS:/);
  });

  it('upgrades image appearances without data loss and reapplies without changing permissions', async () => {
    const imageMigration = await readFile(
      path.resolve('supabase/migrations/202609130002_profile_images.sql'),
      'utf8',
    );
    const ownerId = 'c3333333-3333-4333-8333-333333333333';
    const oldAppearance = {
      backgroundImageUrl: `media:${ownerId}/11111111-1111-4111-8111-111111111111.webp`,
      backgroundPosition: 'bottom',
      avatarPosition: 'top',
      backgroundOverlay: 60,
      dashboardBackground: false,
    };
    const withoutTransaction = (sql: string) =>
      sql.replace(/^begin;\s*$/m, '').replace(/^commit;\s*$/m, '');
    await database.exec('begin');
    try {
      await database.exec(withoutTransaction(imageMigration));
      await database.query('insert into auth.users (id, email) values ($1, $2)', [
        ownerId,
        'linkboard-customization-upgrade@example.invalid',
      ]);
      await database.query(
        "update public.profiles set name = 'Existing owner', appearance = $1 where id = $2",
        [JSON.stringify(oldAppearance), ownerId],
      );
      await database.exec(withoutTransaction(customizationMigration));
      await database.exec(withoutTransaction(customizationMigration));
      const saved = await database.query<{ name: string; appearance: object }>(
        'select name, appearance from public.profiles where id = $1',
        [ownerId],
      );
      expect(saved.rows[0]).toEqual({ name: 'Existing owner', appearance: oldAppearance });
      const permissions = await database.query<{ can_edit: boolean; anon_can_edit: boolean }>(`
        select has_column_privilege('authenticated', 'public.profiles', 'appearance', 'UPDATE') as can_edit,
          has_column_privilege('anon', 'public.profiles', 'appearance', 'UPDATE') as anon_can_edit
      `);
      expect(permissions.rows[0]).toEqual({ can_edit: true, anon_can_edit: false });
    } finally {
      await database.exec('rollback');
    }
    const results = await database.exec(authorizationTests);
    expect((results.at(-1)?.rows[0] as { result: string }).result).toMatch(/^PASS:/);
  });

  it('persists every customization for its owner and returns it on the published page', async () => {
    const ownerId = 'c3333333-3333-4333-8333-333333333333';
    await database.exec('begin');
    try {
      await database.query('insert into auth.users (id, email) values ($1, $2)', [
        ownerId,
        'linkboard-customization-roundtrip@example.invalid',
      ]);
      await database.exec('set local role authenticated');
      await database.query("select set_config('request.jwt.claim.sub', $1, true)", [ownerId]);
      const saved = await database.query<{ appearance: object }>(
        "update public.profiles set username = 'customized-page', appearance = $1, published = true where id = $2 returning appearance",
        [JSON.stringify(customizedAppearance), ownerId],
      );
      expect(saved.rows[0].appearance).toEqual(customizedAppearance);
      // Profile-only PATCHes from existing clients retain all new fields.
      await database.query('update public.profiles set bio = $1 where id = $2', [
        'Updated by an existing client',
        ownerId,
      ]);
      await database.exec('reset role; set local role anon');
      const published = await database.query<{ profile: { appearance: object; bio: string } }>(
        "select public.get_public_profile('customized-page') as profile",
      );
      expect(published.rows[0].profile.appearance).toEqual(customizedAppearance);
      expect(published.rows[0].profile.bio).toBe('Updated by an existing client');
    } finally {
      await database.exec('rollback');
    }
  });

  it.each(Object.entries(appearanceNumbers))(
    'enforces the numeric bounds and JSON types for %s',
    async (key, [min, max]) => {
      for (const [value, expected] of [
        [min, true],
        [max, true],
        [min - 1, false],
        [max + 1, false],
        [min + 0.5, false],
        [String(min), false],
        [null, false],
        [true, false],
      ] as const) {
        const result = await database.query<{ valid: boolean }>(
          'select private.linkboard_valid_appearance($1::jsonb, $2::uuid) as valid',
          [JSON.stringify({ [key]: value }), 'a1111111-1111-4111-8111-111111111111'],
        );
        expect(result.rows[0].valid, `${key}=${JSON.stringify(value)}`).toBe(expected);
      }
    },
  );

  it.each(Object.entries(appearanceEnums))(
    'accepts only the predefined %s choices',
    async (key, choices) => {
      for (const value of choices) {
        const result = await database.query<{ valid: boolean }>(
          'select private.linkboard_valid_appearance($1::jsonb, $2::uuid) as valid',
          [JSON.stringify({ [key]: value }), 'a1111111-1111-4111-8111-111111111111'],
        );
        expect(result.rows[0].valid, `${key}=${JSON.stringify(value)}`).toBe(true);
      }
      for (const value of [null, {}, [], ['center'], 'unsupported', true, 900, '400']) {
        const result = await database.query<{ valid: boolean }>(
          'select private.linkboard_valid_appearance($1::jsonb, $2::uuid) as valid',
          [JSON.stringify({ [key]: value }), 'a1111111-1111-4111-8111-111111111111'],
        );
        expect(result.rows[0].valid, `${key}=${JSON.stringify(value)}`).toBe(false);
      }
    },
  );

  it.each(appearanceColors)('accepts six-digit hex colors only for %s', async (key) => {
    for (const [value, expected] of [
      ['#aB12Cd', true],
      ['#000000', true],
      ['#FFFFFF', true],
      ['#fff', false],
      ['#FFFFFF00', false],
      ['red', false],
      ['', false],
      ['#12345g', false],
      ['#123456\n', false],
      ['var(--private)', false],
      [null, false],
      [123456, false],
      ['url(https://example.com)', false],
    ] as const) {
      const result = await database.query<{ valid: boolean }>(
        'select private.linkboard_valid_appearance($1::jsonb, $2::uuid) as valid',
        [JSON.stringify({ [key]: value }), 'a1111111-1111-4111-8111-111111111111'],
      );
      expect(result.rows[0].valid, `${key}=${JSON.stringify(value)}`).toBe(expected);
    }
  });

  it.each(appearanceBooleans)('accepts boolean values only for %s', async (key) => {
    for (const value of [true, false, 'true', 'false', 0, 1, null]) {
      const result = await database.query<{ valid: boolean }>(
        'select private.linkboard_valid_appearance($1::jsonb, $2::uuid) as valid',
        [JSON.stringify({ [key]: value }), 'a1111111-1111-4111-8111-111111111111'],
      );
      expect(result.rows[0].valid, `${key}=${JSON.stringify(value)}`).toBe(
        typeof value === 'boolean',
      );
    }
  });

  it('upgrades a profile without an appearance column while preserving its existing data', async () => {
    const migration = await readFile(
      path.resolve('supabase/migrations/202609130002_profile_images.sql'),
      'utf8',
    );
    const ownerId = 'c3333333-3333-4333-8333-333333333333';
    await database.exec('begin');
    try {
      await database.exec(`
        alter table public.profiles drop column appearance cascade;
        alter table public.profiles drop constraint profiles_avatar_valid;
        alter table public.profiles add constraint profiles_avatar_valid
          check (private.linkboard_safe_url(avatar_url, true));
      `);
      await database.query('insert into auth.users (id, email) values ($1, $2)', [
        ownerId,
        'linkboard-upgrade-test@example.invalid',
      ]);
      await database.query(
        "update public.profiles set name = 'Existing owner', bio = 'Keep this biography', avatar_url = 'https://example.com/avatar.png' where id = $1",
        [ownerId],
      );
      // Keep the migration inside this fixture's rollback boundary.
      await database.exec(migration.replace(/^begin;\s*$/m, '').replace(/^commit;\s*$/m, ''));
      const result = await database.query<{
        name: string;
        bio: string;
        avatar_url: string;
        appearance: object;
      }>('select name, bio, avatar_url, appearance from public.profiles where id = $1', [ownerId]);
      expect(result.rows[0]).toEqual({
        name: 'Existing owner',
        bio: 'Keep this biography',
        avatar_url: 'https://example.com/avatar.png',
        appearance: {},
      });
    } finally {
      await database.exec('rollback');
    }
  });

  it.each([
    null,
    [],
    { backgroundImageUrl: 'http://example.com/image.png' },
    { backgroundImageUrl: 'data:image/webp;base64,AAAA' },
    { backgroundImageUrl: 'javascript:alert(1)' },
    {
      backgroundImageUrl:
        'media:b2222222-2222-4222-8222-222222222222/12345678-1234-4234-8234-123456789012.webp',
    },
    {
      backgroundImageUrl:
        'media:a1111111-1111-4111-8111-111111111111/../12345678-1234-4234-8234-123456789012.webp',
    },
    {
      backgroundImageUrl:
        'media:a1111111-1111-4111-8111-111111111111/12345678-1234-4234-8234-123456789012.svg',
    },
    { backgroundPosition: 'left' },
    { avatarPosition: null },
    { dashboardBackground: 'true' },
    { backgroundOverlay: -1 },
    { backgroundOverlay: 81 },
    { backgroundOverlay: 1.5 },
    { backgroundOverlay: '40' },
    { privateNote: 'must not leak via public JSON' },
  ])('rejects unsafe appearance data in SQL: %j', async (appearance) => {
    const result = await database.query<{ valid: boolean }>(
      'select private.linkboard_valid_appearance($1::jsonb, $2::uuid) as valid',
      [JSON.stringify(appearance), 'a1111111-1111-4111-8111-111111111111'],
    );
    expect(result.rows[0]?.valid).toBe(false);
  });

  it.each([
    {},
    { backgroundImageUrl: '' },
    { backgroundImageUrl: 'https://example.com/image.png' },
    {
      backgroundImageUrl:
        'media:a1111111-1111-4111-8111-111111111111/12345678-1234-4234-8234-123456789012.webp',
      backgroundPosition: 'bottom',
      avatarPosition: 'top',
      backgroundOverlay: 80,
      dashboardBackground: true,
    },
  ])('accepts supported appearance data in SQL: %j', async (appearance) => {
    const result = await database.query<{ valid: boolean }>(
      'select private.linkboard_valid_appearance($1::jsonb, $2::uuid) as valid',
      [JSON.stringify(appearance), 'a1111111-1111-4111-8111-111111111111'],
    );
    expect(result.rows[0]?.valid).toBe(true);
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
