import { HttpError } from './errors';
import { BuiltinStore, SESSION_SECONDS } from './store';

export const SESSION_COOKIE = 'linkboard_session';
export const MAX_BODY_BYTES = 96 * 1024;

export function assertBuiltinAvailable(): void {
  if (
    [
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ].some((value) => value?.trim())
  )
    throw new HttpError(
      503,
      'This installation uses Supabase. Use the configured account service.',
    );
  if (process.env.VERCEL || process.env.NETLIFY)
    throw new HttpError(
      503,
      'Configure Supabase on this host. Built-in accounts need a server with persistent storage.',
    );
}

function siteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      )
        throw new Error('Invalid site origin');
      return url.origin;
    } catch {
      throw new HttpError(
        503,
        'The site URL is not configured correctly. Contact the site administrator.',
      );
    }
  }
  const requestUrl = new URL(request.url);
  // Next.js constructs request.url from its bind address. The browser's actual
  // authority remains in Host (for example 127.0.0.1 instead of 0.0.0.0).
  // Validate only the direct authority; forwarded headers never select a host.
  const host = request.headers.get('host');
  if (!host) return requestUrl.origin;
  if (host.length > 300 || !/^(?:\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::[0-9]{1,5})?$/i.test(host))
    throw new HttpError(400, 'The request host is invalid.');
  try {
    return new URL(`${requestUrl.protocol}//${host}`).origin;
  } catch {
    throw new HttpError(400, 'The request host is invalid.');
  }
}

/** Browser mutations must carry a matching Origin; do not trust proxy headers. */
export function requireSameOrigin(request: Request): void {
  if (request.headers.get('origin') !== siteOrigin(request))
    throw new HttpError(
      403,
      'This request came from another site. Reload this page and try again.',
    );
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    throw new HttpError(
      403,
      'This request came from another site. Reload this page and try again.',
    );
}

export function sessionToken(request: Request): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie || cookie.length > 16_384) return null;
  const value = cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function sessionCookie(request: Request, token: string | null): string {
  const secure = siteOrigin(request).startsWith('https:') ? '; Secure' : '';
  const maxAge = token ? SESSION_SECONDS : 0;
  const expires = new Date(token ? Date.now() + SESSION_SECONDS * 1000 : 0).toUTCString();
  return `${SESSION_COOKIE}=${token || ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Expires=${expires}${secure}`;
}

export async function readJson(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || ''))
    throw new HttpError(415, 'Send the request as JSON.');
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES))
    throw new HttpError(413, 'This request is too large. Shorten the profile and try again.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'The request body is missing.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new HttpError(413, 'This request is too large. Shorten the profile and try again.');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new HttpError(400, 'The request must contain a JSON object.');
    return parsed;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'The request could not be read. Send valid JSON and try again.');
  } finally {
    reader.releaseLock();
  }
}

export function json(value: unknown, status = 200, cookie?: string): Response {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie',
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
    },
  });
}

export async function endpoint(
  request: Request,
  action: (store: BuiltinStore) => Response | Promise<Response>,
): Promise<Response> {
  try {
    assertBuiltinAvailable();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) requireSameOrigin(request);
    return await action(new BuiltinStore());
  } catch (error) {
    if (error instanceof HttpError) {
      const response = json({ error: error.message }, error.status);
      if (error.status === 429)
        response.headers.set('Retry-After', String(error.retryAfterSeconds || 60));
      return response;
    }
    // Log only the exception class; SQL paths, password hashes and user input
    // should never be reflected in an API error or routine server log.
    console.error(
      'Linkboard backend request failed.',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return json(
      { error: 'The server could not complete this request. Please try again shortly.' },
      503,
    );
  }
}
