import { endpoint, json, readJson } from '../../../lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return endpoint(request, async (store) => {
    store.click(await readJson(request));
    return json({ ok: true });
  });
}
