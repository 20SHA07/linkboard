import { endpoint, sessionToken } from '../../../../../lib/server/http';
import { MediaStore } from '../../../../../lib/server/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; file: string }> },
): Promise<Response> {
  return endpoint(request, async (store) => {
    const { owner, file } = await params;
    const account = store.account(sessionToken(request));
    const bytes = new MediaStore().read(owner, file, account?.id ?? null);
    return new Response(bytes, {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'same-origin',
        Vary: 'Cookie',
      },
    });
  });
}
