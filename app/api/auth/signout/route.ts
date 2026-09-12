import { endpoint, json, sessionCookie, sessionToken } from '../../../../lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return endpoint(request, (store) => {
    store.signout(sessionToken(request));
    return json({ ok: true }, 200, sessionCookie(request, null));
  });
}
