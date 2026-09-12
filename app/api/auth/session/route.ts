import { endpoint, json, sessionToken } from '../../../../lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return endpoint(request, (store) => json({ account: store.account(sessionToken(request)) }));
}
