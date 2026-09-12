import { describe, expect, it } from 'vitest';
import type { Profile } from '../lib/types';
import { safeUrl, validateEmail, validateProfile } from '../lib/validation';

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '7348af18-bb12-4a28-ad4f-a336ca5c6e4b',
    username: 'jane-doe',
    name: 'Jane Doe',
    bio: 'Designer, maker, and occasional photographer.',
    avatarUrl: 'https://images.example.com/jane.jpg',
    theme: 'sand',
    backgroundColor: '#F6F4EF',
    published: true,
    links: [
      {
        id: 'portfolio',
        title: 'My portfolio',
        url: 'https://example.com/work',
        platform: 'website',
        enabled: true,
      },
    ],
    ...overrides,
  };
}

describe('navigation URL safety', () => {
  it.each([
    'https://instagram.com/jane',
    'http://example.com/',
    'https://example.com/work?tag=art%20design#recent',
    'https://例え.テスト/path',
    'mailto:jane+hello@example.com',
  ])('allows a usable destination: %s', (value) => {
    expect(safeUrl(value)).toBe(true);
  });

  it.each([
    '',
    'javascript:alert(document.cookie)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://example.com/file',
    '//example.com',
    '/relative/path',
    'https://user:password@example.com',
    'https://user@example.com',
    'https://example.com\\@evil.example',
    'https://exam\nple.com',
    ' https://example.com',
    'https://example.com/a b',
    'https://',
    'mailto:not-an-email',
    'mailto:jane@example.com?subject=hello',
    'mailto:jane@example.com,other@example.com',
    'mailto:jane@example.com%0d%0aBcc:other@example.com',
    `https://example.com/${'x'.repeat(2048)}`,
  ])('rejects an unsafe or malformed destination: %s', (value) => {
    expect(safeUrl(value)).toBe(false);
  });

  it('does not throw when persisted URL data has the wrong type', () => {
    expect(safeUrl(null as unknown as string)).toBe(false);
    expect(safeUrl({} as unknown as string)).toBe(false);
  });
});

describe('email validation', () => {
  it('accepts normal and tagged addresses', () => {
    expect(validateEmail('jane@example.com')).toBe(true);
    expect(validateEmail('jane+linkboard@sub.example.co.uk')).toBe(true);
  });

  it.each([
    '',
    'jane',
    '@example.com',
    'jane@',
    'jane@example',
    'jane doe@example.com',
    'jane@example.com\n',
  ])('rejects invalid form input: %s', (value) => {
    expect(validateEmail(value)).toBe(false);
  });
});

describe('profile validation', () => {
  it('accepts a complete profile and a valid empty draft', () => {
    expect(validateProfile(profile())).toBeNull();
    expect(
      validateProfile(profile({ bio: '', avatarUrl: '', links: [], published: false })),
    ).toBeNull();
  });

  it.each([
    'ab',
    'Jane-Doe',
    'jane doe',
    '-jane',
    'jane-',
    'jane--doe',
    'jane/doe',
    'a'.repeat(31),
    'admin',
    'login',
    'api',
  ])('rejects a username unsuitable for a public route: %s', (username) => {
    expect(validateProfile(profile({ username }))).toEqual(expect.any(String));
  });

  it('rejects duplicate link IDs because tracking needs a stable unique target', () => {
    const saved = profile();
    saved.links.push({
      ...saved.links[0],
      title: 'Different destination',
      url: 'https://other.example.com',
    });
    expect(validateProfile(saved)).toMatch(/duplicate/i);
  });

  it('validates disabled links before they can later be enabled', () => {
    const saved = profile();
    saved.links[0] = { ...saved.links[0], enabled: false, url: 'javascript:alert(1)' };
    expect(validateProfile(saved)).toEqual(expect.any(String));
  });

  it('rejects oversized profile content', () => {
    expect(validateProfile(profile({ name: 'a'.repeat(61) }))).toEqual(expect.any(String));
    expect(validateProfile(profile({ bio: 'a'.repeat(281) }))).toEqual(expect.any(String));
    const saved = profile();
    saved.links = Array.from({ length: 31 }, (_, index) => ({
      ...saved.links[0],
      id: `link-${index}`,
    }));
    expect(validateProfile(saved)).toEqual(expect.any(String));
  });

  it('requires a nonblank profile name and link title', () => {
    expect(validateProfile(profile({ name: '   ' }))).toEqual(expect.any(String));
    const saved = profile();
    saved.links[0].title = ' \t ';
    expect(validateProfile(saved)).toEqual(expect.any(String));
  });

  it('rejects unsafe avatar content and invalid appearance values', () => {
    for (const avatarUrl of [
      'javascript:alert(1)',
      'data:image/svg+xml,<svg/>',
      'http://example.com/avatar.png',
    ]) {
      expect(validateProfile(profile({ avatarUrl }))).toEqual(expect.any(String));
    }
    expect(
      validateProfile(profile({ backgroundColor: 'red; background:url(https://example.com)' })),
    ).toEqual(expect.any(String));
    expect(validateProfile(profile({ theme: 'missing' as Profile['theme'] }))).toEqual(
      expect.any(String),
    );
  });

  it.each([null, undefined, {}, { links: [null] }])(
    'returns a readable error for corrupt persisted data',
    (value) => {
      expect(() => validateProfile(value as unknown as Profile)).not.toThrow();
      expect(validateProfile(value as unknown as Profile)).toEqual(expect.any(String));
    },
  );

  it('handles malformed nested links without throwing', () => {
    for (const links of [[null], [{}], 'not-an-array']) {
      const saved = { ...profile(), links } as unknown as Profile;
      expect(() => validateProfile(saved)).not.toThrow();
      expect(validateProfile(saved)).toEqual(expect.any(String));
    }
  });
});
