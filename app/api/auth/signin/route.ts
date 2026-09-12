import { endpoint, json, readJson, sessionCookie } from '../../../../lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return endpoint(request, async (store) => {
    const { account, token } = await store.signin(await readJson(request));
    return json({ account }, 200, sessionCookie(request, token));
  });
}
