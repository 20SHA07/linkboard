import { endpoint, json, readJson, sessionToken } from '../../../lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request): Promise<Response> {
  return endpoint(request, async (store) => {
    store.saveProfile(sessionToken(request), await readJson(request));
    return json({ ok: true });
  });
}
