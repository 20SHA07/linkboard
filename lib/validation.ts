import type { Platform, Profile, Theme } from './types';

export const MAX_LINKS = 30;
export const MAX_BIO_LENGTH = 280;
export const platforms: readonly Platform[] = [
  'website',
  'instagram',
  'youtube',
  'twitter',
  'tiktok',
  'linkedin',
  'github',
  'spotify',
  'mail',
];
export const themes: readonly Theme[] = ['sand', 'sage', 'rose', 'ink', 'custom'];
const reservedUsernames = new Set([
  'admin',
  'login',
  'signup',
  'profile',
  'api',
  'auth',
  'settings',
  'analytics',
  'share',
]);
const unsafeCharacters = /[\s\u0000-\u001f\u007f\\]/;

export function validateEmail(email: string): boolean {
  return (
    typeof email === 'string' &&
    email.length <= 254 &&
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(
      email,
    )
  );
}

/** Keep navigation URLs absolute and executable URL schemes out of saved data. */
export function safeUrl(url: string): boolean {
  if (typeof url !== 'string' || !url || url.length > 2048 || unsafeCharacters.test(url))
    return false;
  if (/^mailto:/i.test(url)) {
    const address = url.slice(7);
    return !/[?&#%]/.test(address) && validateEmail(address);
  }
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    return (
      ['https:', 'http:'].includes(parsed.protocol) &&
      !!parsed.hostname &&
      !parsed.username &&
      !parsed.password &&
      parsed.href.length <= 2048
    );
  } catch {
    return false;
  }
}

export function validateUsername(username: string): boolean {
  return (
    typeof username === 'string' &&
    username.length >= 3 &&
    username.length <= 30 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(username) &&
    !reservedUsernames.has(username)
  );
}

export function safeAvatarUrl(url: string): boolean {
  return url === '' || (safeUrl(url) && /^https:\/\//i.test(url));
}

/** Validates untrusted form/storage values as well as correctly typed profiles. */
export function validateProfile(profile: Profile): string | null {
  if (!profile || typeof profile !== 'object')
    return 'The profile could not be read. Please reload and try again.';
  if (typeof profile.id !== 'string' || !profile.id)
    return 'This profile is missing its account ID.';
  if (!validateUsername(profile.username))
    return 'Choose a unique username with 3–30 lowercase letters, numbers, and single hyphens. App route names are reserved.';
  if (typeof profile.name !== 'string' || !profile.name.trim() || profile.name.length > 60)
    return 'Your profile name must contain 1–60 characters.';
  if (typeof profile.bio !== 'string' || profile.bio.length > MAX_BIO_LENGTH)
    return 'Keep your bio to 280 characters or fewer.';
  if (typeof profile.avatarUrl !== 'string' || !safeAvatarUrl(profile.avatarUrl))
    return 'Use a valid HTTPS image URL, or leave the avatar blank.';
  if (!themes.includes(profile.theme)) return 'Choose one of the available themes.';
  if (
    typeof profile.backgroundColor !== 'string' ||
    !/^#[0-9a-f]{6}$/i.test(profile.backgroundColor)
  )
    return 'Choose a background color in six-digit hex format, such as #f6f4ef.';
  if (typeof profile.published !== 'boolean') return 'The published setting must be on or off.';
  if (!Array.isArray(profile.links) || profile.links.length > MAX_LINKS)
    return 'A profile can have up to 30 links.';
  const seen = new Set<string>();
  for (const [index, link] of profile.links.entries()) {
    if (!link || typeof link !== 'object') return `Link ${index + 1} could not be read.`;
    if (typeof link.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(link.id) || seen.has(link.id))
      return `Link ${index + 1} has an invalid or duplicate ID. Remove it and add it again.`;
    seen.add(link.id);
    if (typeof link.title !== 'string' || !link.title.trim() || link.title.length > 80)
      return `Give link ${index + 1} a title of 1–80 characters.`;
    if (!safeUrl(link.url))
      return `Link ${index + 1} needs a valid http://, https://, or mailto: URL.`;
    if (!platforms.includes(link.platform))
      return `Choose a supported platform for link ${index + 1}.`;
    if (typeof link.enabled !== 'boolean') return `Link ${index + 1} must be enabled or disabled.`;
  }
  return null;
}
