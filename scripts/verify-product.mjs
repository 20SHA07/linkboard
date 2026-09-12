import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Exercise the actual production HTTP routes. All accounts and data exist only
// in this disposable database; the installation's database is never touched.
const directory = await mkdtemp(path.join(tmpdir(), 'linkboard-http-'));
const portReservation = createServer();
await new Promise((resolve) => portReservation.listen(0, '127.0.0.1', resolve));
const port = portReservation.address().port;
await new Promise((resolve) => portReservation.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const password = randomBytes(24).toString('base64url');
let server;
let logs = '';

async function start() {
  server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'],
    {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        LINKBOARD_DATABASE_PATH: path.join(directory, 'verify.sqlite'),
        NEXT_PUBLIC_SITE_URL: '',
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
        VERCEL: '',
        NETLIFY: '',
      },
    },
  );
  server.stdout.on('data', (chunk) => {
    logs = (logs + chunk.toString()).slice(-4000);
  });
  server.stderr.on('data', (chunk) => {
    logs = (logs + chunk.toString()).slice(-4000);
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Verification server exited: ${logs}`);
    try {
      if ((await fetch(`${origin}/api/auth/session`)).ok) return;
    } catch {
      /* Server starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Verification server did not start: ${logs}`);
}

async function stop() {
  if (!server || server.exitCode !== null) return;
  const closed = new Promise((resolve) => server.once('exit', resolve));
  server.kill('SIGTERM');
  await closed;
}

async function request(route, method = 'GET', body, cookie, requestOrigin = origin) {
  const response = await fetch(`${origin}${route}`, {
    method,
    headers: {
      ...(method === 'GET' ? {} : { Origin: requestOrigin, 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get('set-cookie'),
  };
}

try {
  await start();
  assert.equal((await request('/api/dashboard')).status, 401);
  assert.deepEqual((await request('/api/auth/session')).data, { account: null });
  assert.equal(
    (
      await request(
        '/api/auth/signup',
        'POST',
        { email: 'denied@example.com', password },
        undefined,
        'https://another.example',
      )
    ).status,
    403,
  );
  const a = await request('/api/auth/signup', 'POST', { email: 'owner-a@example.com', password });
  const b = await request('/api/auth/signup', 'POST', { email: 'owner-b@example.com', password });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.match(a.cookie, /HttpOnly/);
  assert.match(a.cookie, /SameSite=Lax/);
  const cookieA = a.cookie.split(';')[0];
  const cookieB = b.cookie.split(';')[0];
  const initial = await request('/api/dashboard', 'GET', undefined, cookieA);
  const profile = initial.data.profile;
  assert.equal(profile.id, a.data.account.id);
  assert.equal(profile.published, false);
  assert.deepEqual(profile.links, []);
  assert.deepEqual(initial.data.events, []);
  assert.equal(profile.bio, '');
  assert.equal(profile.avatarUrl, '');
  assert.equal((await request(`/api/public/${profile.username}`)).data.profile, null);
  profile.name = 'Verified owner';
  profile.username = 'verified-owner';
  profile.links = [
    {
      id: 'public-link',
      title: 'My website',
      url: 'https://example.com',
      platform: 'website',
      enabled: true,
    },
    {
      id: 'private-link',
      title: 'Private link',
      url: 'https://example.com/private',
      platform: 'website',
      enabled: false,
    },
  ];
  profile.published = true;
  assert.equal((await request('/api/profile', 'PUT', profile, cookieB)).status, 403);
  assert.equal((await request('/api/profile', 'PUT', profile, cookieA)).status, 200);
  const publicProfile = (await request('/api/public/verified-owner')).data.profile;
  assert.equal(publicProfile.links.length, 1);
  assert.equal(publicProfile.links[0].id, 'public-link');
  assert.equal(
    (await request('/api/click', 'POST', { profileId: profile.id, linkId: 'private-link' })).status,
    404,
  );
  assert.equal(
    (
      await request('/api/click', 'POST', {
        profileId: profile.id,
        linkId: 'public-link',
        timestamp: '1999-01-01',
      })
    ).status,
    200,
  );
  const recorded = (await request('/api/dashboard', 'GET', undefined, cookieA)).data.events;
  assert.equal(recorded.length, 1);
  assert.ok(Date.now() - Date.parse(recorded[0].timestamp) < 60_000);
  assert.deepEqual((await request('/api/dashboard', 'GET', undefined, cookieB)).data.events, []);
  assert.equal(
    (
      await request('/api/auth/signin', 'POST', {
        email: 'owner-a@example.com',
        password: 'wrong-password',
      })
    ).status,
    401,
  );
  await stop();
  await start();
  assert.equal(
    (await request('/api/dashboard', 'GET', undefined, cookieA)).data.profile.name,
    'Verified owner',
  );
  assert.equal((await request('/api/dashboard', 'GET', undefined, cookieA)).data.events.length, 1);
  assert.equal((await request('/api/auth/signout', 'POST', {}, cookieA)).status, 200);
  assert.equal((await request('/api/dashboard', 'GET', undefined, cookieA)).status, 401);
  const signin = await request('/api/auth/signin', 'POST', {
    email: 'owner-a@example.com',
    password,
  });
  assert.equal(signin.status, 200);
  assert.notEqual(signin.cookie.split(';')[0], cookieA);
  console.log(
    'PASS: Production HTTP registration, login, private profiles, owner isolation, click tracking, restart persistence, and session revocation.',
  );
  if (process.argv.includes('--review')) {
    if (!process.stdin.isTTY) throw new Error('Interactive review requires a terminal.');
    console.log(JSON.stringify({ url: origin, email: 'owner-a@example.com', password }));
    console.log(
      'This account exists only in the temporary test database. Press Enter to stop and remove it.',
    );
    await new Promise((resolve) => {
      const done = () => {
        process.stdin.off('data', done);
        process.off('SIGINT', done);
        process.off('SIGTERM', done);
        process.stdin.pause();
        resolve();
      };
      process.stdin.once('data', done);
      process.once('SIGINT', done);
      process.once('SIGTERM', done);
      process.stdin.resume();
    });
  }
} finally {
  await stop();
  // Only remove the fresh temporary directory allocated by this verification run.
  const absolute = path.resolve(directory);
  if (
    !absolute.startsWith(path.resolve(tmpdir()) + path.sep) ||
    !path.basename(absolute).startsWith('linkboard-http-')
  )
    throw new Error('Unexpected verification directory; cleanup refused.');
  await rm(absolute, { recursive: true, force: true });
}
