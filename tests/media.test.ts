import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as upload } from '../app/api/media/route';
import { GET as download } from '../app/api/media/[owner]/[file]/route';
import { PUT as save } from '../app/api/profile/route';
import { closeDatabase, getDatabase } from '../lib/server/database';
import { ACCOUNT_IMAGE_QUOTA_BYTES, MAX_IMAGE_BYTES } from '../lib/server/media';
import { BuiltinStore, hashToken } from '../lib/server/store';
import { testProfile } from './fixtures';
import type { Profile } from '../lib/types';

const origin = 'http://localhost:3000';
// A real, tiny WebP fixture; the product does not import test assets.
const webp = Uint8Array.from(
  Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64'),
);
let directory: string;
let databaseFile: string;
let owner: { id: string; cookie: string; token: string };
let other: { id: string; cookie: string; token: string };

function account() {
  const id = randomUUID();
  const token = randomBytes(32).toString('base64url');
  const database = getDatabase();
  database
    .prepare('INSERT INTO accounts VALUES (?, ?, ?, ?)')
    .run(id, `${id}@example.com`, 'test-only-unused-password-hash', Date.now());
  const profile = { ...testProfile, id, username: `test-${id.slice(0, 8)}`, published: false };
  database
    .prepare('INSERT INTO profiles VALUES (?, ?, ?)')
    .run(id, profile.username, JSON.stringify(profile));
  database
    .prepare('INSERT INTO sessions VALUES (?, ?, ?)')
    .run(hashToken(token), id, Date.now() + 60_000);
  return { id, token, cookie: `linkboard_session=${token}` };
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'linkboard-media-test-'));
  databaseFile = join(directory, 'media.sqlite');
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
  owner = account();
  other = account();
});

afterEach(() => {
  closeDatabase(databaseFile);
  const absolute = resolve(directory);
  if (!absolute.startsWith(join(resolve(tmpdir()), 'linkboard-media-test-')))
    throw new Error('Unexpected media test cleanup path');
  rmSync(absolute, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function imageRequest(
  body: Uint8Array<ArrayBuffer> = webp,
  cookie: string | null = owner.cookie,
  expectedOwnerId = owner.id,
) {
  return new Request(`${origin}/api/media`, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'image/webp',
      'x-linkboard-owner': expectedOwnerId,
      ...(cookie ? { cookie } : {}),
    },
    body,
  });
}

function getImage(source: string, cookie?: string) {
  const [ownerId, file] = source.slice('media:'.length).split('/');
  return download(
    new Request(`${origin}/api/media/${ownerId}/${file}`, {
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ owner: ownerId, file }) },
  );
}

async function uploaded(): Promise<string> {
  const result = await upload(imageRequest());
  expect(result.status).toBe(201);
  return (await result.json()).source;
}

function profileDocument(patch: Partial<Profile>) {
  const store = new BuiltinStore();
  const profile = { ...store.dashboard(owner.token).profile, ...patch };
  getDatabase()
    .prepare('UPDATE profiles SET document = ? WHERE id = ?')
    .run(JSON.stringify(profile), owner.id);
  return profile;
}

describe('persistent uploaded images', () => {
  it('assigns a random owner-scoped name and returns identical image bytes to its owner', async () => {
    const source = await uploaded();
    expect(source).toMatch(new RegExp(`^media:${owner.id}/[0-9a-f-]{36}\\.webp$`));
    const result = await getImage(source, owner.cookie);
    expect(result.status).toBe(200);
    expect(result.headers.get('content-type')).toBe('image/webp');
    expect(result.headers.get('cache-control')).toContain('no-store');
    expect(result.headers.get('x-content-type-options')).toBe('nosniff');
    expect(result.headers.get('vary')).toBe('Cookie');
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(webp);
    expect(await uploaded()).not.toBe(source);
  });

  it('keeps images private before publication and denies another account access', async () => {
    const source = await uploaded();
    profileDocument({ avatarUrl: source, published: false });
    expect((await getImage(source)).status).toBe(404);
    expect((await getImage(source, other.cookie)).status).toBe(404);
    expect((await getImage(source, owner.cookie)).status).toBe(200);
    expect((await getImage(source.replace(owner.id, other.id), other.cookie)).status).toBe(404);
  });

  it('only exposes currently referenced published avatars and immediately revokes access', async () => {
    const source = await uploaded();
    const unused = await uploaded();
    profileDocument({ avatarUrl: source, published: true });
    expect((await getImage(source)).status).toBe(200);
    expect((await getImage(unused)).status).toBe(404);
    profileDocument({ avatarUrl: '', published: true });
    expect((await getImage(source)).status).toBe(404);
    profileDocument({ avatarUrl: source, published: false });
    expect((await getImage(source)).status).toBe(404);
  });

  it('allows a published background image reference and preserves it after database restart', async () => {
    const source = await uploaded();
    profileDocument({ appearance: { backgroundImageUrl: source }, published: true });
    closeDatabase(databaseFile);
    expect((await getImage(source)).status).toBe(200);
    expect(new Uint8Array(await (await getImage(source)).arrayBuffer())).toEqual(webp);
    profileDocument({ appearance: { backgroundImageUrl: '' } });
    expect((await getImage(source)).status).toBe(404);
  });

  it('persists image and editing controls through the normal profile save API', async () => {
    const source = await uploaded();
    const profile: Profile = {
      ...new BuiltinStore().dashboard(owner.token).profile,
      avatarUrl: source,
      appearance: {
        backgroundImageUrl: source,
        backgroundPosition: 'bottom',
        backgroundOverlay: 40,
        avatarPosition: 'top',
        dashboardBackground: true,
        backgroundFit: 'contain',
        backgroundGradientColor: '#123456',
        backgroundGradientAngle: 125,
        textColor: '#223344',
        headingColor: '#FFFFFF',
        linkTextColor: '#001122',
        linkBackgroundColor: '#aabbcc',
        linkBorderColor: '#998877',
        avatarBorderColor: '#654321',
        fontFamily: 'mono',
        headingFontFamily: 'serif',
        headingWeight: 500,
        headingSize: 44,
        bioSize: 18,
        linkFontSize: 20,
        avatarSize: 164,
        avatarShape: 'rounded',
        avatarBorderWidth: 5,
        textAlign: 'left',
        linkAlign: 'right',
        linkStyle: 'outline',
        linkShadow: 'bold',
        linkRadius: 12,
        linkBorderWidth: 2,
        linkGap: 22,
        linkPadding: 24,
        contentWidth: 680,
        contentPadding: 72,
        showAvatar: false,
        showBranding: false,
        showQrCode: false,
        showLinkIcons: false,
        showLinkArrows: false,
      },
    };
    const result = await save(
      new Request(`${origin}/api/profile`, {
        method: 'PUT',
        headers: { origin, 'content-type': 'application/json', cookie: owner.cookie },
        body: JSON.stringify(profile),
      }),
    );
    expect(result.status).toBe(200);
    closeDatabase(databaseFile);
    expect(new BuiltinStore().dashboard(owner.token).profile).toEqual({
      ...profile,
      links: profile.links.map((link) => ({ ...link, url: new URL(link.url).href })),
    });
    const persisted = new BuiltinStore().dashboard(owner.token).profile;
    new BuiltinStore().saveProfile(owner.token, { ...persisted, published: true });
    expect(new BuiltinStore().publicProfile(persisted.username)?.appearance).toEqual(
      profile.appearance,
    );
  });

  it('canonicalizes external image URLs while preserving optional controls', async () => {
    const profile = {
      ...new BuiltinStore().dashboard(owner.token).profile,
      appearance: {
        backgroundImageUrl: 'https://example.com',
        avatarPosition: 'center' as const,
        textColor: undefined,
        avatarSize: undefined,
        showAvatar: false,
      },
    };
    new BuiltinStore().saveProfile(owner.token, profile);
    expect(new BuiltinStore().dashboard(owner.token).profile.appearance).toEqual({
      backgroundImageUrl: 'https://example.com/',
      avatarPosition: 'center',
      showAvatar: false,
    });
  });

  it('preserves legacy profiles without appearance settings and supports a full reset', () => {
    const store = new BuiltinStore();
    const legacy = store.dashboard(owner.token).profile;
    expect(legacy.appearance).toBeUndefined();
    store.saveProfile(owner.token, legacy);
    expect(store.dashboard(owner.token).profile).not.toHaveProperty('appearance');
    store.saveProfile(owner.token, {
      ...legacy,
      appearance: { avatarSize: 180, textColor: '#123456' },
    });
    store.saveProfile(owner.token, { ...legacy, appearance: {} });
    closeDatabase(databaseFile);
    expect(new BuiltinStore().dashboard(owner.token).profile.appearance).toEqual({});
  });

  it('rejects unsafe customization through the profile API without changing stored settings', async () => {
    const store = new BuiltinStore();
    const existing = store.dashboard(owner.token).profile;
    const result = await save(
      new Request(`${origin}/api/profile`, {
        method: 'PUT',
        headers: { origin, 'content-type': 'application/json', cookie: owner.cookie },
        body: JSON.stringify({ ...existing, appearance: { textColor: 'red;display:none' } }),
      }),
    );
    expect(result.status).toBe(400);
    expect(store.dashboard(owner.token).profile).toEqual(existing);
  });

  it('revokes owner access when the session is expired', async () => {
    const source = await uploaded();
    getDatabase().prepare('UPDATE sessions SET expires_at = 0').run();
    expect((await getImage(source, owner.cookie)).status).toBe(404);
    expect((await upload(imageRequest())).status).toBe(401);
  });
});

describe('image upload request boundaries', () => {
  it('does not store an image in a changed account or accept an unspecified owner', async () => {
    expect((await upload(imageRequest(webp, other.cookie, owner.id))).status).toBe(403);
    const unspecified = imageRequest();
    unspecified.headers.delete('x-linkboard-owner');
    expect((await upload(unspecified)).status).toBe(403);
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM media').get()?.count).toBe(0);
  });
  it('requires login and same-origin before reading or storing image data', async () => {
    expect((await upload(imageRequest(webp, null))).status).toBe(401);
    const foreign = imageRequest();
    foreign.headers.set('origin', 'https://other.example');
    expect((await upload(foreign)).status).toBe(403);
    const missing = imageRequest();
    missing.headers.delete('origin');
    expect((await upload(missing)).status).toBe(403);
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM media').get()?.count).toBe(0);
  });

  it('rejects other image types, SVG, corrupted and truncated containers', async () => {
    const wrongType = imageRequest();
    wrongType.headers.set('content-type', 'image/svg+xml');
    expect((await upload(wrongType)).status).toBe(415);
    expect(
      (await upload(imageRequest(new TextEncoder().encode('<svg onload="alert(1)"/>')))).status,
    ).toBe(415);
    expect((await upload(imageRequest(webp.slice(0, -2)))).status).toBe(415);
    const brokenChunk = webp.slice();
    new DataView(brokenChunk.buffer).setUint32(16, webp.length * 2, true);
    expect((await upload(imageRequest(brokenChunk))).status).toBe(415);
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM media').get()?.count).toBe(0);
  });

  it('caps both declared and actual body sizes, including a false Content-Length', async () => {
    const declared = imageRequest();
    declared.headers.set('content-length', String(MAX_IMAGE_BYTES + 1));
    expect((await upload(declared)).status).toBe(413);
    const actual = imageRequest(new Uint8Array(MAX_IMAGE_BYTES + 1));
    actual.headers.set('content-length', '1');
    expect((await upload(actual)).status).toBe(413);
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM media').get()?.count).toBe(0);
  });

  it.each(['../database.sqlite', 'bad.webp', `${randomUUID()}.svg`, `${randomUUID()}.webp/extra`])(
    'rejects unsafe or invalid image paths: %s',
    async (file) => {
      const response = await download(new Request(`${origin}/api/media`), {
        params: Promise.resolve({ owner: owner.id, file }),
      });
      expect(response.status).toBe(404);
    },
  );

  it('enforces an isolated 50 MB account quota without affecting another account', async () => {
    const database = getDatabase();
    const insert = database.prepare(
      'INSERT INTO media(owner_id, filename, content, created_at) VALUES (?, ?, zeroblob(?), ?)',
    );
    for (let size = 0; size < ACCOUNT_IMAGE_QUOTA_BYTES; size += MAX_IMAGE_BYTES)
      insert.run(owner.id, `${randomUUID()}.webp`, MAX_IMAGE_BYTES, Date.now());
    expect((await upload(imageRequest())).status).toBe(413);
    expect((await upload(imageRequest(webp, other.cookie, other.id))).status).toBe(201);
    expect(
      database.prepare('SELECT COUNT(*) AS count FROM media WHERE owner_id = ?').get(owner.id)
        ?.count,
    ).toBe(ACCOUNT_IMAGE_QUOTA_BYTES / MAX_IMAGE_BYTES);
  });
});
