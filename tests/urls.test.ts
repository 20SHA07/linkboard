import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function urls({ base = '', exported = false, site = '' } = {}) {
  vi.stubEnv('NEXT_PUBLIC_BASE_PATH', base);
  vi.stubEnv('NEXT_PUBLIC_STATIC_EXPORT', String(exported));
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', site);
  vi.resetModules();
  return import('../lib/urls');
}

describe('deployment URLs', () => {
  it.each([
    ['', '#error=access_denied&error_code=otp_expired', 'expired'],
    ['?error_code=otp_expired', '', 'expired'],
    ['?confirmation=expired', '', 'expired'],
    ['?confirmation=failed', '', 'failed'],
    ['', '#error_description=%3Cscript%3Euntrusted%3C%2Fscript%3E', 'failed'],
    ['?confirmation=untrusted', '', null],
    ['', '#access_token=valid-callback&refresh_token=test', null],
  ])('maps confirmation failures to fixed messages: %s %s', async (search, hash, expected) => {
    const url = await urls();
    expect(url.confirmationFailure(search, hash)).toBe(expected);
  });

  it('preserves server profile paths and same-origin API routes', async () => {
    const url = await urls();
    expect(url.publicProfileUrl('someone', 'http://localhost:3000')).toBe(
      'http://localhost:3000/u/someone',
    );
    expect(url.appPath('/api/auth/session')).toBe('/api/auth/session');
  });

  it('generates static profile URLs that exist after a fresh Pages load', async () => {
    const url = await urls({
      base: '/linkboard',
      exported: true,
      site: 'https://20sha07.github.io',
    });
    expect(url.publicProfileUrl('new-account', 'http://localhost:3000')).toBe(
      'https://20sha07.github.io/linkboard/u/?username=new-account',
    );
    expect(url.appPath('/')).toBe('/linkboard/');
  });

  it('supports root-domain static hosting and escapes profile names', async () => {
    const url = await urls({ exported: true });
    expect(url.publicProfilePath('test/name?')).toBe('/u/?username=test%2Fname%3F');
  });

  it('supports a prefixed server installation', async () => {
    const url = await urls({ base: '/links' });
    expect(url.publicProfilePath('someone')).toBe('/links/u/someone');
    expect(url.appPath('/api/dashboard')).toBe('/links/api/dashboard');
  });

  it.each(['not a url', 'javascript:alert(1)', 'https://user:password@example.com'])(
    'falls back from unsafe canonical origin %s',
    async (site) => {
      const url = await urls({ site });
      expect(url.publicProfileUrl('someone', 'https://links.example.com')).toBe(
        'https://links.example.com/u/someone',
      );
    },
  );
});
