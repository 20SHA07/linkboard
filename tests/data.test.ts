import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testProfile } from './fixtures';

const backend = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  signInWithPassword: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: backend.createClient }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
  vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '');
  vi.stubEnv('NEXT_PUBLIC_STATIC_EXPORT', '');
  vi.stubGlobal('window', { location: { origin: 'https://links.example.com' } });
  backend.createClient.mockReturnValue({
    auth: {
      getUser: backend.getUser,
      signUp: backend.signUp,
      resend: backend.resend,
      signInWithPassword: backend.signInWithPassword,
    },
    from: backend.from,
    rpc: backend.rpc,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function configuredData() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-key-for-unit-tests');
  return import('../lib/data');
}

describe('configuration and authentication boundaries', () => {
  it('resends signup confirmation only for a valid email and preserves the Pages redirect', async () => {
    vi.stubEnv('NEXT_PUBLIC_STATIC_EXPORT', 'true');
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/linkboard');
    vi.stubGlobal('window', { location: { origin: 'https://20sha07.github.io' } });
    const data = await configuredData();
    backend.resend.mockResolvedValue({ data: {}, error: null });
    await expect(data.resendConfirmation('invalid')).rejects.toThrow(/valid email/);
    expect(backend.resend).not.toHaveBeenCalled();
    await data.resendConfirmation(' owner@example.com ');
    expect(backend.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'owner@example.com',
      options: { emailRedirectTo: 'https://20sha07.github.io/linkboard/' },
    });
  });

  it('surfaces email sending limits instead of reporting a confirmation sent', async () => {
    const data = await configuredData();
    backend.resend.mockResolvedValue({ error: { message: 'Email rate limit exceeded' } });
    await expect(data.resendConfirmation('owner@example.com')).rejects.toThrow(
      'Email rate limit exceeded',
    );
  });

  it('does not attempt hosted confirmation for built-in accounts', async () => {
    const data = await import('../lib/data');
    await expect(data.resendConfirmation('owner@example.com')).rejects.toThrow(
      /does not use email confirmation/,
    );
    expect(backend.createClient).not.toHaveBeenCalled();
  });

  it('bounds a stalled hosted request and keeps the error actionable', async () => {
    const timeout = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
              once: true,
            });
          }),
      ),
    );
    const data = await configuredData();
    backend.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await data.getCurrentUser();
    const hostedFetch = backend.createClient.mock.calls[0][2].global.fetch as typeof fetch;
    const request = hostedFetch('https://project.supabase.co/auth/v1/user');
    const rejection = expect(request).rejects.toMatchObject({
      name: 'AbortError',
      message: 'The server took too long to respond. Check your connection and try again.',
    });
    timeout.abort(new DOMException('Request timed out', 'TimeoutError'));
    await rejection;
    expect(timeoutSpy).toHaveBeenCalledWith(20_000);
  });

  it('preserves caller cancellation and request options in hosted requests', async () => {
    const timeout = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const data = await configuredData();
    backend.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await data.getCurrentUser();
    const hostedFetch = backend.createClient.mock.calls[0][2].global.fetch as typeof fetch;
    const caller = new AbortController();
    const options = {
      method: 'POST',
      headers: { apikey: 'public-test-key' },
      body: '{"value":"kept"}',
      signal: caller.signal,
    };
    await hostedFetch('https://project.supabase.co/rest/v1/rpc/get_public_profile', options);
    const forwarded = fetchMock.mock.calls[0][1];
    expect(forwarded).toMatchObject({ ...options, signal: expect.any(AbortSignal) });
    expect(forwarded.signal.aborted).toBe(false);
    caller.abort();
    expect(forwarded.signal.aborted).toBe(true);
    expect(timeout.signal.aborted).toBe(false);
  });

  it('uses real server sessions by default without requiring a hosted backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ account: null }));
    vi.stubGlobal('fetch', fetchMock);
    const data = await import('../lib/data');
    expect(data.usesSupabase).toBe(false);
    expect(await data.getCurrentUser()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/session',
      expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }),
    );
    expect(backend.createClient).not.toHaveBeenCalled();
  });

  it.each(['url-only', 'anon-key-only', 'publishable-key-only'])(
    'fails visibly for partial configuration: %s',
    async (mode) => {
      if (mode === 'url-only')
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
      if (mode === 'anon-key-only') vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-key');
      if (mode === 'publishable-key-only')
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-key');
      const data = await import('../lib/data');
      expect(data.usesSupabase).toBe(true);
      await expect(data.getCurrentUser()).rejects.toThrow(/not fully configured/i);
      expect(backend.createClient).not.toHaveBeenCalled();
    },
  );

  it('requires a configured hosted backend in static mode and never calls a missing server API', async () => {
    vi.stubEnv('NEXT_PUBLIC_STATIC_EXPORT', 'true');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const data = await import('../lib/data');
    expect(data.usesSupabase).toBe(true);
    await expect(data.getCurrentUser()).rejects.toThrow(/not fully configured/i);
    await expect(data.signUp('owner@example.com', 'a-long-test-password')).rejects.toThrow(
      /not fully configured/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(backend.createClient).not.toHaveBeenCalled();
  });

  it('surfaces auth outages instead of switching to another backend', async () => {
    const data = await configuredData();
    backend.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthRetryableFetchError', message: 'Auth service unavailable' },
    });
    expect(data.usesSupabase).toBe(true);
    await expect(data.loadDashboard()).rejects.toThrow('Auth service unavailable');
    expect(backend.from).not.toHaveBeenCalled();
  });

  it('recognizes a missing session and denies dashboard access', async () => {
    const data = await configuredData();
    backend.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthSessionMissingError', message: 'No session' },
    });
    expect(await data.getCurrentUser()).toBeNull();
    await expect(data.loadDashboard()).rejects.toThrow(/Sign in/);
    expect(backend.from).not.toHaveBeenCalled();
  });

  it('blocks loading another account before issuing a table query', async () => {
    const data = await configuredData();
    backend.getUser.mockResolvedValue({
      data: { user: { id: 'owner-a', email: 'a@example.com' } },
      error: null,
    });
    await expect(data.loadDashboard('owner-b')).rejects.toThrow(/own dashboard/);
    expect(backend.from).not.toHaveBeenCalled();
  });

  it('blocks another profile owner from being passed to save', async () => {
    const data = await configuredData();
    const { testProfile } = await import('./fixtures');
    backend.getUser.mockResolvedValue({
      data: { user: { id: 'owner-b', email: 'b@example.com' } },
      error: null,
    });
    await expect(data.saveProfile(testProfile)).rejects.toThrow(/account that owns/);
    expect(backend.from).not.toHaveBeenCalled();
  });

  it.each([
    ['not-an-email', 'long-example-password'],
    ['jane@example.com', 'short'],
    ['jane@example.com', 'x'.repeat(129)],
  ])('validates signup before contacting auth', async (email, password) => {
    const data = await configuredData();
    await expect(data.signUp(email, password)).rejects.toThrow();
    expect(backend.signUp).not.toHaveBeenCalled();
  });

  it('uses the actual app origin for email confirmation and reports confirmation state', async () => {
    const data = await configuredData();
    backend.signUp.mockResolvedValue({ data: { session: null }, error: null });
    expect(await data.signUp(' jane@example.com ', 'long-example-password')).toEqual({
      confirmationRequired: true,
    });
    expect(backend.signUp).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'long-example-password',
      options: { emailRedirectTo: 'https://links.example.com/' },
    });
    backend.signUp.mockResolvedValue({
      data: { session: { access_token: 'test-session' } },
      error: null,
    });
    expect(await data.signUp('jane@example.com', 'long-example-password')).toEqual({
      confirmationRequired: false,
    });
  });

  it('propagates a failed signup instead of reporting an account created', async () => {
    const data = await configuredData();
    backend.signUp.mockResolvedValue({
      data: { session: null },
      error: { message: 'Email rate limit exceeded' },
    });
    await expect(data.signUp('jane@example.com', 'long-example-password')).rejects.toThrow(
      'Email rate limit exceeded',
    );
  });

  it('keeps the GitHub Pages project path in the signup confirmation redirect', async () => {
    vi.stubEnv('NEXT_PUBLIC_STATIC_EXPORT', 'true');
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/linkboard');
    vi.stubGlobal('window', { location: { origin: 'https://20sha07.github.io' } });
    const data = await configuredData();
    backend.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await data.signUp('owner@example.com', 'a-long-test-password');
    expect(backend.signUp).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'a-long-test-password',
      options: { emailRedirectTo: 'https://20sha07.github.io/linkboard/' },
    });
  });
});

describe('built-in server API', () => {
  beforeEach(() => {
    // Keep account-change messages inside this test process; no browser or storage is used.
    vi.stubGlobal('BroadcastChannel', undefined);
  });

  it('finishes successful authentication when cross-tab channels are blocked', async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        throw new DOMException('Storage access denied', 'SecurityError');
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => Response.json({ ok: true })),
    );
    const data = await import('../lib/data');
    await expect(data.signIn('owner@example.com', 'a-long-test-password')).resolves.toBeUndefined();
    await expect(data.signOut()).resolves.toBeUndefined();
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
  });

  it('still detects account changes on focus when cross-tab channels are blocked', async () => {
    const browser = new EventTarget();
    const document = new EventTarget();
    vi.stubGlobal('window', browser);
    vi.stubGlobal('document', document);
    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        throw new DOMException('Storage access denied', 'SecurityError');
      }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ account: null })));
    const data = await import('../lib/data');
    const callback = vi.fn();
    const unsubscribe = data.subscribeAuth(callback);
    browser.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(null));
    unsubscribe();
    browser.dispatchEvent(new Event('focus'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('prefixes server API requests when the app is hosted below a project path', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/linkboard');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ account: null }));
    vi.stubGlobal('fetch', fetchMock);
    const data = await import('../lib/data');
    expect(await data.getCurrentUser()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/linkboard/api/auth/session',
      expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }),
    );
    expect(backend.createClient).not.toHaveBeenCalled();
  });

  it('creates an account, signs in, and signs out through the cookie-authenticated API', async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    const account = { id: testProfile.id, email: 'owner@example.com' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ account, confirmationRequired: false }, { status: 201 }),
      )
      .mockResolvedValueOnce(Response.json({ account }))
      .mockResolvedValueOnce(Response.json({ account }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const data = await import('../lib/data');

    expect(await data.signUp(' owner@example.com ', 'a-long-test-password')).toEqual({
      confirmationRequired: false,
    });
    await data.signIn(' owner@example.com ', 'a-long-test-password');
    expect(await data.getCurrentUser()).toEqual(account);
    await data.signOut();

    expect(
      fetchMock.mock.calls.map(([path, options]) => [path, options.method, options.body]),
    ).toEqual([
      [
        '/api/auth/signup',
        'POST',
        JSON.stringify({ email: 'owner@example.com', password: 'a-long-test-password' }),
      ],
      [
        '/api/auth/signin',
        'POST',
        JSON.stringify({ email: 'owner@example.com', password: 'a-long-test-password' }),
      ],
      ['/api/auth/session', 'GET', undefined],
      ['/api/auth/signout', 'POST', '{}'],
    ]);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options).toMatchObject({ credentials: 'same-origin', cache: 'no-store' });
      expect(options.headers).toMatchObject({ Accept: 'application/json' });
      expect(options.headers).not.toHaveProperty('Authorization');
      if (options.body) expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
    expect(dispatchEvent.mock.calls.map(([event]) => event.type)).toEqual([
      'linkboard:auth',
      'linkboard:auth',
      'linkboard:auth',
    ]);
    expect(backend.createClient).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials before contacting the built-in server', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const data = await import('../lib/data');
    await expect(data.signUp('invalid', 'a-long-test-password')).rejects.toThrow(/email/i);
    await expect(data.signUp('owner@example.com', 'short')).rejects.toThrow(/12/);
    await expect(data.signIn('owner@example.com', '')).rejects.toThrow(/password/i);
    await expect(data.signIn('owner@example.com', 'x'.repeat(129))).rejects.toThrow(/password/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads the signed-in owner’s persisted profile and server timestamps', async () => {
    const events = [{ id: 'click-one', linkId: 'website', timestamp: '2026-09-12T08:30:00.000Z' }];
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ profile: testProfile, events }));
    vi.stubGlobal('fetch', fetchMock);
    const data = await import('../lib/data');
    expect(await data.loadDashboard(testProfile.id)).toEqual({ profile: testProfile, events });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard',
      expect.objectContaining({
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      }),
    );
    expect(backend.from).not.toHaveBeenCalled();
  });

  it('rejects a dashboard response from a different account after a session change', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ profile: testProfile, events: [] })),
    );
    const data = await import('../lib/data');
    await expect(data.loadDashboard('another-owner')).rejects.toThrow(/account changed/i);
  });

  it('sends profile changes as a validated PUT and preserves owner authorization errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(
        Response.json({ error: 'You can only change your own profile.' }, { status: 403 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const data = await import('../lib/data');
    await data.saveProfile(testProfile);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/profile',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify(testProfile),
      }),
    );
    await expect(data.saveProfile({ ...testProfile, id: 'another-owner' })).rejects.toThrow(
      /own profile/,
    );
    await expect(data.saveProfile({ ...testProfile, username: '../admin' })).rejects.toThrow(
      /username/i,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fetches public profiles without turning a missing profile into seeded content', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ profile: testProfile }))
      .mockResolvedValueOnce(Response.json({ profile: null }));
    vi.stubGlobal('fetch', fetchMock);
    const data = await import('../lib/data');
    expect(await data.getPublicProfile(testProfile.username)).toEqual(testProfile);
    expect(await data.getPublicProfile('unpublished-owner')).toBeNull();
    expect(await data.getPublicProfile('../admin')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/public/test-owner',
      expect.objectContaining({
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      }),
    );
  });

  it('submits only valid click identifiers and suppresses immediate duplicate clicks', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);
    const data = await import('../lib/data');
    await data.trackClick('not-a-profile-id', 'website');
    await data.trackClick(testProfile.id, '../invalid');
    expect(fetchMock).not.toHaveBeenCalled();
    await data.trackClick(testProfile.id, 'website');
    await data.trackClick(testProfile.id, 'website');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/click',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ profileId: testProfile.id, linkId: 'website' }),
      }),
    );
    expect(backend.rpc).not.toHaveBeenCalled();
  });

  it('rejects failed click recording rather than claiming the event was saved', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: 'This link is not available.' }, { status: 404 }),
        ),
    );
    const data = await import('../lib/data');
    await expect(data.trackClick(testProfile.id, 'website')).rejects.toThrow(/not available/);
  });

  it('announces expired authentication and preserves the server’s actionable error', async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: 'Sign in to access your dashboard.' }, { status: 401 }),
        ),
    );
    const data = await import('../lib/data');
    await expect(data.loadDashboard()).rejects.toThrow('Sign in to access your dashboard.');
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0][0].type).toBe('linkboard:auth');
    expect(backend.createClient).not.toHaveBeenCalled();
  });

  it.each(['<html>Gateway failure</html>', 'null', '42', '"unexpected"'])(
    'rejects malformed successful API output: %s',
    async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
      const data = await import('../lib/data');
      await expect(data.getCurrentUser()).rejects.toThrow(/unexpected response/i);
      expect(backend.createClient).not.toHaveBeenCalled();
    },
  );

  it('uses a readable fallback for an HTML server error without reflecting its body', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('<html>Internal gateway details</html>', { status: 502 })),
    );
    const data = await import('../lib/data');
    await expect(data.getPublicProfile('test-owner')).rejects.toThrow(
      'The request could not be completed. Please try again.',
    );
  });

  it('surfaces network failure without creating a fallback session or switching providers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Internal connection details')));
    const data = await import('../lib/data');
    await expect(data.getCurrentUser()).rejects.toThrow(/server couldn’t be reached/i);
    await expect(data.signUp('owner@example.com', 'a-long-test-password')).rejects.toThrow(
      /server couldn’t be reached/i,
    );
    expect(backend.createClient).not.toHaveBeenCalled();
  });
});

describe('public profile access', () => {
  it('uses the restricted public RPC and preserves unavailable-profile state', async () => {
    const data = await configuredData();
    backend.rpc.mockResolvedValue({ data: null, error: null });
    expect(await data.getPublicProfile('jane-doe')).toBeNull();
    expect(backend.rpc).toHaveBeenCalledWith('get_public_profile', { p_username: 'jane-doe' });
    expect(backend.from).not.toHaveBeenCalled();
  });

  it('returns a retryable error rather than a false missing-profile result on backend failure', async () => {
    const data = await configuredData();
    backend.rpc.mockResolvedValue({ data: null, error: { message: 'Network unavailable' } });
    await expect(data.getPublicProfile('jane-doe')).rejects.toThrow('Network unavailable');
  });

  it('does not query the backend for an invalid public username', async () => {
    const data = await configuredData();
    expect(await data.getPublicProfile('../admin')).toBeNull();
    expect(backend.rpc).not.toHaveBeenCalled();
  });
});

describe('profile persistence', () => {
  it('normalizes international hostnames before sending them to database validation', async () => {
    const data = await configuredData();
    const { testProfile } = await import('./fixtures');
    backend.getUser.mockResolvedValue({
      data: { user: { id: testProfile.id, email: 'jane@example.com' } },
      error: null,
    });
    const saved = structuredClone(testProfile);
    saved.avatarUrl = 'https://例え.テスト/avatar.png';
    saved.links[0].url = 'https://例え.テスト/work';
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: saved.id }, error: null }),
        }),
      }),
    });
    backend.from.mockReturnValue({ update });
    await data.saveProfile(saved);
    const payload = update.mock.calls[0][0];
    expect(payload.avatar_url).toBe(new URL(saved.avatarUrl).href);
    expect(payload.links[0].url).toBe(new URL(saved.links[0].url).href);
  });

  it('rejects an update that affects no row rather than claiming it was saved', async () => {
    const data = await configuredData();
    const { testProfile } = await import('./fixtures');
    backend.getUser.mockResolvedValue({
      data: { user: { id: testProfile.id, email: 'jane@example.com' } },
      error: null,
    });
    backend.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });
    await expect(data.saveProfile(testProfile)).rejects.toThrow(/not saved/i);
  });
});
