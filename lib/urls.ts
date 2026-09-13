/** Public values are fixed at build time, including a Pages project's path prefix. */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || '';
export const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';

/** Translate auth callback failures without displaying untrusted provider text. */
export function confirmationFailure(search: string, hash = ''): 'expired' | 'failed' | null {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const forwarded = query.get('confirmation');
  if (forwarded === 'expired' || forwarded === 'failed') return forwarded;
  if ([query, fragment].some((params) => params.get('error_code') === 'otp_expired'))
    return 'expired';
  return [query, fragment].some((params) =>
    ['error', 'error_code', 'error_description'].some((key) => params.has(key)),
  )
    ? 'failed'
    : null;
}

export function appPath(path: string): string {
  return `${basePath}${path.startsWith('/') ? path : `/${path}`}`;
}

export function publicProfilePath(username: string): string {
  const encoded = encodeURIComponent(username);
  return appPath(isStaticExport ? `/u/?username=${encoded}` : `/u/${encoded}`);
}

/** Keep generated links and QR codes on the same saved profile address. */
export function publicProfileUrl(username: string, fallbackOrigin: string): string {
  let origin = fallbackOrigin;
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password)
        origin = url.origin;
    } catch {
      // The current location remains usable when an optional canonical URL is invalid.
    }
  }
  return new URL(publicProfilePath(username), origin).href;
}
