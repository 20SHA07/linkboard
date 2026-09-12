import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  signUp: vi.fn(),
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
  vi.stubGlobal('window', { location: { origin: 'https://links.example.com' } });
  backend.createClient.mockReturnValue({
    auth: {
      getUser: backend.getUser,
      signUp: backend.signUp,
      signInWithPassword: backend.signInWithPassword,
    },
    from: backend.from,
    rpc: backend.rpc,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function configuredData() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-key-for-unit-tests');
  return import('../lib/data');
}

describe('configuration and authentication boundaries', () => {
  it('makes unconfigured mode a demo and refuses to create pretend accounts', async () => {
    const data = await import('../lib/data');
    expect(data.isDemo).toBe(true);
    expect(await data.getCurrentUser()).toBeNull();
    await expect(data.signUp('jane@example.com', 'long-example-password')).rejects.toThrow(
      /Connect Supabase/,
    );
    await expect(data.signIn('jane@example.com', 'long-example-password')).rejects.toThrow(
      /Connect Supabase/,
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
      expect(data.isDemo).toBe(false);
      await expect(data.getCurrentUser()).rejects.toThrow(/not fully configured/i);
      expect(backend.createClient).not.toHaveBeenCalled();
    },
  );

  it('surfaces auth outages instead of falling back to local demo data', async () => {
    const data = await configuredData();
    backend.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthRetryableFetchError', message: 'Auth service unavailable' },
    });
    expect(data.isDemo).toBe(false);
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
    const { demoProfile } = await import('../lib/demo');
    backend.getUser.mockResolvedValue({
      data: { user: { id: 'owner-b', email: 'b@example.com' } },
      error: null,
    });
    await expect(data.saveProfile(demoProfile)).rejects.toThrow(/account that owns/);
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
    const { demoProfile } = await import('../lib/demo');
    backend.getUser.mockResolvedValue({
      data: { user: { id: demoProfile.id, email: 'jane@example.com' } },
      error: null,
    });
    const saved = structuredClone(demoProfile);
    saved.avatarUrl = 'https://例え.テスト/avatar.png';
    saved.links[0].url = 'https://例え.テスト/work';
    const update = vi
      .fn()
      .mockReturnValue({
        eq: vi
          .fn()
          .mockReturnValue({
            select: vi
              .fn()
              .mockReturnValue({
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
    const { demoProfile } = await import('../lib/demo');
    backend.getUser.mockResolvedValue({
      data: { user: { id: demoProfile.id, email: 'jane@example.com' } },
      error: null,
    });
    backend.from.mockReturnValue({
      update: vi
        .fn()
        .mockReturnValue({
          eq: vi
            .fn()
            .mockReturnValue({
              select: vi
                .fn()
                .mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
            }),
        }),
    });
    await expect(data.saveProfile(demoProfile)).rejects.toThrow(/not saved/i);
  });
});
