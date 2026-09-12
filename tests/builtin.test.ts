import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { GET as session } from '../app/api/auth/session/route';
import { POST as signup } from '../app/api/auth/signup/route';
import { POST as signin } from '../app/api/auth/signin/route';
import { POST as signout } from '../app/api/auth/signout/route';
import { GET as dashboard } from '../app/api/dashboard/route';
import { PUT as save } from '../app/api/profile/route';
import { GET as publicProfile } from '../app/api/public/[username]/route';
import { POST as click } from '../app/api/click/route';
import { closeDatabase, getDatabase } from '../lib/server/database';
import { MAX_BODY_BYTES } from '../lib/server/http';
import { hashToken } from '../lib/server/store';
import type { Profile } from '../lib/types';

let directory: string;
let databaseFile: string;
const origin = 'http://localhost:3000';
const password = 'a-long-unique-test-password';

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'linkboard-builtin-test-'));
  databaseFile = join(directory, 'accounts.sqlite');
  vi.stubEnv('LINKBOARD_DATABASE_PATH', databaseFile);
  for (const key of [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SITE_URL',
    'VERCEL',
    'NETLIFY',
  ])
    vi.stubEnv(key, '');
});

afterEach(() => {
  closeDatabase(databaseFile);
  // Only clean the unique directory created by this test, never the app database.
  const resolved = resolve(directory);
  if (!resolved.startsWith(join(resolve(tmpdir()), 'linkboard-builtin-test-')))
    throw new Error('Unexpected test cleanup path');
  rmSync(resolved, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function request(path: string, method = 'GET', body?: unknown, cookie?: string): Request {
  return new Request(`${origin}/api/${path}`, {
    method,
    headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function register(
  email = 'first@example.com',
): Promise<{ cookie: string; profile: Profile }> {
  const response = await signup(request('auth/signup', 'POST', { email, password }));
  expect(response.status).toBe(201);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  const result = await dashboard(request('dashboard', 'GET', undefined, cookie));
  expect(result.status).toBe(200);
  return { cookie, profile: (await result.json()).profile };
}

function publishable(profile: Profile): Profile {
  return {
    ...profile,
    username: 'real-profile',
    name: 'A real person',
    published: true,
    links: [
      {
        id: 'public-link',
        title: 'My website',
        url: 'https://example.com',
        platform: 'website',
        enabled: true,
      },
      {
        id: 'private-link',
        title: 'Unreleased work',
        url: 'https://private.example.com',
        platform: 'website',
        enabled: false,
      },
    ],
  };
}

describe('built-in real accounts and persistence', () => {
  it('requires a session for the dashboard and issues no account to anonymous callers', async () => {
    expect(await (await session(request('auth/session'))).json()).toEqual({ account: null });
    expect((await dashboard(request('dashboard'))).status).toBe(401);
    expect(
      (await dashboard(request('dashboard', 'GET', undefined, 'linkboard_session=forged'))).status,
    ).toBe(401);
  });

  it('registers a real private, empty profile with an HttpOnly session', async () => {
    const response = await signup(
      request('auth/signup', 'POST', { email: 'First@Example.com', password }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      confirmationRequired: false,
      account: { id: expect.any(String), email: 'first@example.com' },
    });
    const setCookie = response.headers.get('set-cookie')!;
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Max-Age=2592000');
    expect(setCookie).not.toContain('; Secure');
    const result = await dashboard(request('dashboard', 'GET', undefined, setCookie.split(';')[0]));
    expect(result.headers.get('cache-control')).toContain('no-store');
    expect(await result.json()).toMatchObject({
      profile: {
        id: body.account.id,
        name: 'first',
        bio: '',
        avatarUrl: '',
        links: [],
        published: false,
      },
      events: [],
    });
    const stored = getDatabase(databaseFile).prepare('SELECT password_hash FROM accounts').get()!;
    expect(stored.password_hash).toMatch(/^scrypt-v1:[a-f0-9]{48}:[a-f0-9]{128}$/);
    expect(stored.password_hash).not.toContain(password);
    const token = setCookie.split(';')[0].split('=')[1];
    expect(
      getDatabase(databaseFile).prepare('SELECT token_hash FROM sessions').get()!.token_hash,
    ).toBe(hashToken(token));
  });

  it('persists profiles and sessions after closing and reopening the database', async () => {
    const { cookie, profile } = await register();
    expect((await save(request('profile', 'PUT', publishable(profile), cookie))).status).toBe(200);
    expect(
      (await click(request('click', 'POST', { profileId: profile.id, linkId: 'public-link' })))
        .status,
    ).toBe(200);
    closeDatabase(databaseFile);
    const response = await dashboard(request('dashboard', 'GET', undefined, cookie));
    expect(await response.json()).toMatchObject({
      profile: { name: 'A real person', username: 'real-profile' },
      events: [{ linkId: 'public-link' }],
    });
  });

  it('authenticates by password and revokes the exact session on signout', async () => {
    const { cookie } = await register();
    const wrong = await signin(
      request('auth/signin', 'POST', {
        email: 'first@example.com',
        password: 'incorrect-password',
      }),
    );
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get('set-cookie')).toBeNull();
    const unknown = await signin(
      request('auth/signin', 'POST', { email: 'unknown@example.com', password }),
    );
    expect(await unknown.json()).toEqual(await wrong.json());
    const signedIn = await signin(
      request('auth/signin', 'POST', { email: 'FIRST@example.com', password }),
    );
    expect(signedIn.status).toBe(200);
    const otherCookie = signedIn.headers.get('set-cookie')!.split(';')[0];
    expect(otherCookie).not.toBe(cookie);
    const signedOut = await signout(request('auth/signout', 'POST', undefined, cookie));
    expect(signedOut.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await dashboard(request('dashboard', 'GET', undefined, cookie))).status).toBe(401);
    expect((await dashboard(request('dashboard', 'GET', undefined, otherCookie))).status).toBe(200);
  });

  it('rejects expired sessions', async () => {
    const { cookie } = await register();
    getDatabase(databaseFile)
      .prepare('UPDATE sessions SET expires_at = ?')
      .run(Date.now() - 1);
    expect(await (await session(request('auth/session', 'GET', undefined, cookie))).json()).toEqual(
      { account: null },
    );
    expect((await dashboard(request('dashboard', 'GET', undefined, cookie))).status).toBe(401);
  });

  it('rejects duplicate accounts case-insensitively without damaging the first profile', async () => {
    const { cookie, profile } = await register();
    expect(
      (await signup(request('auth/signup', 'POST', { email: 'FIRST@example.com', password })))
        .status,
    ).toBe(409);
    expect(
      (await (await dashboard(request('dashboard', 'GET', undefined, cookie))).json()).profile,
    ).toEqual(profile);
    expect(
      getDatabase(databaseFile).prepare('SELECT COUNT(*) AS count FROM accounts').get()!.count,
    ).toBe(1);
  });
});

describe('tenant isolation, publication and click integrity', () => {
  it('does not expose private profiles, disabled links or other users analytics', async () => {
    const first = await register();
    const second = await register('second@example.com');
    const hidden = await publicProfile(request(`public/${first.profile.username}`), {
      params: Promise.resolve({ username: first.profile.username }),
    });
    expect(await hidden.json()).toEqual({ profile: null });
    expect(
      (await click(request('click', 'POST', { profileId: first.profile.id, linkId: 'anything' })))
        .status,
    ).toBe(404);
    const visible = publishable(first.profile);
    await save(request('profile', 'PUT', visible, first.cookie));
    const publicResponse = await publicProfile(request('public/real-profile'), {
      params: Promise.resolve({ username: visible.username }),
    });
    const publicBody = await publicResponse.json();
    expect(publicBody.profile.links).toHaveLength(1);
    expect(JSON.stringify(publicBody)).not.toContain('private.example.com');
    expect(JSON.stringify(publicBody)).not.toContain('first@example.com');
    expect(
      (
        await click(
          request('click', 'POST', { profileId: first.profile.id, linkId: 'private-link' }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await click(
          request('click', 'POST', { profileId: second.profile.id, linkId: 'public-link' }),
        )
      ).status,
    ).toBe(404);
    const before = Date.now();
    await click(
      request('click', 'POST', {
        profileId: first.profile.id,
        linkId: 'public-link',
        timestamp: '1900-01-01',
        id: 'forged',
      }),
    );
    const firstData = await (
      await dashboard(request('dashboard', 'GET', undefined, first.cookie))
    ).json();
    expect(firstData.events).toHaveLength(1);
    expect(Date.parse(firstData.events[0].timestamp)).toBeGreaterThanOrEqual(before);
    expect(firstData.events[0].id).not.toBe('forged');
    const secondData = await (
      await dashboard(
        request('dashboard?userId=' + first.profile.id, 'GET', undefined, second.cookie),
      )
    ).json();
    expect(secondData.profile.id).toBe(second.profile.id);
    expect(secondData.events).toEqual([]);
  });

  it('rejects cross-account saves and preserves every profile field after a conflict', async () => {
    const first = await register();
    const second = await register('second@example.com');
    await save(request('profile', 'PUT', publishable(first.profile), first.cookie));
    expect(
      (await save(request('profile', 'PUT', { ...first.profile, name: 'Stolen' }, second.cookie)))
        .status,
    ).toBe(403);
    expect(
      (
        await save(
          request(
            'profile',
            'PUT',
            { ...second.profile, username: 'real-profile', name: 'Conflict' },
            second.cookie,
          ),
        )
      ).status,
    ).toBe(409);
    expect(
      (await (await dashboard(request('dashboard', 'GET', undefined, second.cookie))).json())
        .profile,
    ).toEqual(second.profile);
    expect((await save(request('profile', 'PUT', second.profile))).status).toBe(401);
  });

  it('validates saved links server-side and sanitizes extra fields', async () => {
    const { cookie, profile } = await register();
    const input = publishable(profile);
    const bad = { ...input, links: [{ ...input.links[0], url: 'javascript:alert(1)' }] };
    expect((await save(request('profile', 'PUT', bad, cookie))).status).toBe(400);
    expect(
      (await (await dashboard(request('dashboard', 'GET', undefined, cookie))).json()).profile,
    ).toEqual(profile);
    expect(
      (
        await save(
          request('profile', 'PUT', { ...input, password: 'should-not-be-stored' }, cookie),
        )
      ).status,
    ).toBe(200);
    const saved = await (await dashboard(request('dashboard', 'GET', undefined, cookie))).json();
    expect(JSON.stringify(saved)).not.toContain('should-not-be-stored');
    expect(saved.profile.links[0].url).toBe('https://example.com/');
  });

  it('stops returning and tracking a profile immediately after it is unpublished', async () => {
    const { cookie, profile } = await register();
    const published = publishable(profile);
    await save(request('profile', 'PUT', published, cookie));
    await save(request('profile', 'PUT', { ...published, published: false }, cookie));
    expect(
      await (
        await publicProfile(request('public/real-profile'), {
          params: Promise.resolve({ username: 'real-profile' }),
        })
      ).json(),
    ).toEqual({ profile: null });
    expect(
      (await click(request('click', 'POST', { profileId: profile.id, linkId: 'public-link' })))
        .status,
    ).toBe(404);
  });
});

describe('HTTP trust boundaries and abuse controls', () => {
  it.each(['127.0.0.1:43210', 'localhost:43210', '[::1]:43210'])(
    'uses the direct browser Host when Next normalizes its internal URL: %s',
    async (host) => {
      const input = new Request('http://0.0.0.0:43210/api/auth/signout', {
        method: 'POST',
        headers: { host, origin: `http://${host}` },
      });
      expect((await signout(input)).status).toBe(200);
      input.headers.set('origin', 'https://attacker.example');
      input.headers.set('x-forwarded-host', 'attacker.example');
      input.headers.set('x-forwarded-proto', 'https');
      expect((await signout(input)).status).toBe(403);
    },
  );

  it.each([
    'attacker.example/path',
    'user@localhost:3000',
    'localhost:99999',
    'localhost:3000,attacker.example',
  ])('rejects a malformed Host authority: %s', async (host) => {
    const input = request('auth/signout', 'POST');
    input.headers.set('host', host);
    expect((await signout(input)).status).toBe(400);
  });

  it.each(['https://attacker.example', 'null', ''])(
    'rejects a foreign or missing Origin: %s',
    async (foreignOrigin) => {
      const input = request('auth/signup', 'POST', { email: 'first@example.com', password });
      if (foreignOrigin) input.headers.set('origin', foreignOrigin);
      else input.headers.delete('origin');
      input.headers.set('x-forwarded-host', 'attacker.example');
      input.headers.set('x-forwarded-proto', 'https');
      expect((await signup(input)).status).toBe(403);
    },
  );

  it('sets Secure cookies using the configured HTTPS origin behind a reverse proxy', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://links.example.com');
    const input = request('auth/signup', 'POST', { email: 'first@example.com', password });
    input.headers.set('origin', 'https://links.example.com');
    const response = await signup(input);
    expect(response.status).toBe(201);
    expect(response.headers.get('set-cookie')).toContain('; Secure');
    const forged = request('auth/signout', 'POST');
    forged.headers.set('x-forwarded-host', 'localhost:3000');
    expect((await signout(forged)).status).toBe(403);
  });

  it('rejects malformed, excessive, non-object and non-JSON payloads', async () => {
    const malformed = request('auth/signup', 'POST');
    expect((await signup(malformed)).status).toBe(400);
    const array = request('auth/signup', 'POST', []);
    expect((await signup(array)).status).toBe(400);
    const huge = request('auth/signup', 'POST', { field: 'a'.repeat(MAX_BODY_BYTES) });
    huge.headers.set('content-length', '2');
    expect((await signup(huge)).status).toBe(413);
    const notJson = request('auth/signup', 'POST', { email: 'first@example.com', password });
    notJson.headers.set('content-type', 'text/plain');
    expect((await signup(notJson)).status).toBe(415);
    const invalidJson = new Request(`${origin}/api/auth/signup`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: '{broken',
    });
    expect((await signup(invalidJson)).status).toBe(400);
  });

  it.each([
    { email: 'invalid', password },
    { email: 'first@example.com', password: 'short' },
    { email: 'first@example.com', password: 'x'.repeat(129) },
    { email: { inject: true }, password },
  ])('validates account input on the server', async (input) => {
    expect((await signup(request('auth/signup', 'POST', input))).status).toBe(400);
  });

  it.each([
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'VERCEL',
    'NETLIFY',
  ])('fails closed when %s is configured', async (key) => {
    vi.stubEnv(key, 'configured');
    expect((await session(request('auth/session'))).status).toBe(503);
    expect(
      (await signup(request('auth/signup', 'POST', { email: 'first@example.com', password })))
        .status,
    ).toBe(503);
  });

  it('rejects an invalid configured site origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://links.example.com/another-site');
    expect((await signout(request('auth/signout', 'POST'))).status).toBe(503);
  });

  it('persists login throttles and returns a retry hint without leaking passwords', async () => {
    getDatabase(databaseFile)
      .prepare('INSERT INTO rate_limits(key, count, expires_at) VALUES (?, ?, ?)')
      .run(hashToken('signin:email:first@example.com'), 10, Date.now() + 60_000);
    closeDatabase(databaseFile);
    const response = await signin(
      request('auth/signin', 'POST', { email: 'first@example.com', password }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBeTruthy();
    expect(await response.text()).not.toContain(password);
  });

  it('throttles link analytics without adding a rejected click', async () => {
    const { profile, cookie } = await register();
    await save(request('profile', 'PUT', publishable(profile), cookie));
    getDatabase(databaseFile)
      .prepare('INSERT INTO rate_limits(key, count, expires_at) VALUES (?, ?, ?)')
      .run(hashToken(`click:link:${profile.id}:public-link`), 120, Date.now() + 60_000);
    expect(
      (await click(request('click', 'POST', { profileId: profile.id, linkId: 'public-link' })))
        .status,
    ).toBe(429);
    expect(
      (await (await dashboard(request('dashboard', 'GET', undefined, cookie))).json()).events,
    ).toEqual([]);
  });

  it('returns a safe service error when the database cannot open', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('LINKBOARD_DATABASE_PATH', directory);
    const response = await session(request('auth/session'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(directory);
  });
});
