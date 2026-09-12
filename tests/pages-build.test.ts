import { describe, expect, it } from 'vitest';
import { isPublicSupabaseKey, readPagesConfiguration } from '../scripts/build-pages.mjs';

const publicKey = 'sb_publishable_test_for_compilation_only';
const environment = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
  NEXT_PUBLIC_SITE_URL: 'https://20sha07.github.io',
  NEXT_PUBLIC_BASE_PATH: '/linkboard',
};
const jwt = (role: string, alg = 'HS256') =>
  [
    Buffer.from(JSON.stringify({ alg })).toString('base64url'),
    Buffer.from(JSON.stringify({ role })).toString('base64url'),
    'test-signature',
  ].join('.');

describe('Pages build configuration boundary', () => {
  it('allows a setup-only export without inventing a backend', () => {
    expect(readPagesConfiguration({})).toEqual({
      configured: false,
      supabaseUrl: '',
      supabaseKey: '',
      basePath: '/linkboard',
      siteUrl: '',
    });
  });

  it('treats whitespace-only backend configuration as empty', () => {
    expect(
      readPagesConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: ' ',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '\t',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '\n',
      }).configured,
    ).toBe(false);
  });

  it.each([
    { NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey },
    { NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') },
  ])('rejects partial backend configuration', (partial) => {
    expect(() => readPagesConfiguration(partial)).toThrow(/incomplete/i);
  });

  it.each([
    'sb_secret_do_not_ship_this',
    jwt('service_role'),
    jwt('authenticated'),
    jwt('anon', 'none'),
    'malformed-key',
  ])('rejects private or invalid key %s', (key) => {
    expect(isPublicSupabaseKey(key)).toBe(false);
    expect(() =>
      readPagesConfiguration({ ...environment, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }),
    ).toThrow(/public.*key|publishable/i);
  });

  it('accepts public key types without claiming to authenticate them', () => {
    expect(isPublicSupabaseKey(publicKey)).toBe(true);
    expect(isPublicSupabaseKey(jwt('anon'))).toBe(true);
    expect(readPagesConfiguration(environment)).toMatchObject({
      configured: true,
      supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: publicKey,
      basePath: '/linkboard',
      siteUrl: 'https://20sha07.github.io',
    });
  });

  it('rejects private credentials even when another public key takes precedence', () => {
    expect(() =>
      readPagesConfiguration({ ...environment, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('service_role') }),
    ).toThrow(/forbidden/i);
  });

  it('supports a legacy anon key without a publishable key', () => {
    expect(
      readPagesConfiguration({
        ...environment,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon'),
      }),
    ).toMatchObject({ configured: true, supabaseKey: jwt('anon') });
  });

  it.each([
    'http://project.supabase.co',
    'https://secret@project.supabase.co',
    'https://project.supabase.co/path',
    'https://project.supabase.co?key=value',
  ])('rejects invalid backend origin %s', (url) => {
    expect(() => readPagesConfiguration({ ...environment, NEXT_PUBLIC_SUPABASE_URL: url })).toThrow(
      /HTTPS origin/i,
    );
  });

  it.each(['/linkboard/', '/../../private', '//host', 'https://host'])(
    'rejects unsafe path %s',
    (base) => {
      expect(() => readPagesConfiguration({ ...environment, NEXT_PUBLIC_BASE_PATH: base })).toThrow(
        /path/i,
      );
    },
  );

  it('allows a custom domain with no project path', () => {
    expect(readPagesConfiguration({ ...environment, NEXT_PUBLIC_BASE_PATH: '' }).basePath).toBe('');
  });

  it('still validates deployment paths when the backend is absent', () => {
    expect(() => readPagesConfiguration({ NEXT_PUBLIC_BASE_PATH: '/../../private' })).toThrow(/path/i);
    expect(() =>
      readPagesConfiguration({ NEXT_PUBLIC_SITE_URL: 'https://20sha07.github.io/linkboard' }),
    ).toThrow(/origin/i);
  });

  it('rejects a project path inside the canonical origin', () => {
    expect(() =>
      readPagesConfiguration({
        ...environment,
        NEXT_PUBLIC_SITE_URL: 'https://20sha07.github.io/linkboard',
      }),
    ).toThrow(/origin/i);
  });
});
