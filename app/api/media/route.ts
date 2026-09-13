import { HttpError } from '../../../lib/server/errors';
import { endpoint, json, sessionToken } from '../../../lib/server/http';
import { MediaStore, readImage } from '../../../lib/server/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return endpoint(request, async (store) => {
    const account = store.account(sessionToken(request));
    if (!account) throw new HttpError(401, 'Sign in to upload an image.');
    // Bind this write to the account whose editor selected the image. A login
    // change in another tab must not silently store it in a different account.
    if (request.headers.get('x-linkboard-owner') !== account.id)
      throw new HttpError(
        403,
        'Your account changed. Reload your dashboard before uploading an image.',
      );
    const bytes = await readImage(request);
    const source = new MediaStore().upload(account.id, bytes);
    return json({ source }, 201);
  });
}
