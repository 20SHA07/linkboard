/** Public values are fixed at build time, including a Pages project's path prefix. */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || '';
export const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';

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
