import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getDatabase, transaction } from './database';
import { HttpError } from './errors';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const ACCOUNT_IMAGE_QUOTA_BYTES = 50 * 1024 * 1024;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const OWNER = new RegExp(`^${UUID}$`);
const FILENAME = new RegExp(`^${UUID}\\.webp$`);

/** Validate the container as well as the MIME; user filenames are never stored. */
export function validateImage(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_IMAGE_BYTES)
    throw new HttpError(413, 'This image is too large. Choose an image smaller than 2 MB.');
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    buffer.length < 20 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP' ||
    buffer.readUInt32LE(4) !== buffer.length - 8
  )
    throw new HttpError(415, 'Choose a valid image and upload it again.');
  let offset = 12;
  let hasImage = false;
  while (offset < buffer.length) {
    if (buffer.length - offset < 8)
      throw new HttpError(415, 'The image is incomplete. Choose another image.');
    const kind = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (size === 0 || end > buffer.length)
      throw new HttpError(415, 'The image is incomplete. Choose another image.');
    if (kind === 'VP8 ' || kind === 'VP8L') hasImage = true;
    offset = end;
  }
  if (!hasImage) throw new HttpError(415, 'Choose a still image and upload it again.');
}

/** Bound the stream even if Content-Length is absent or dishonest. */
export async function readImage(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  if (!/^image\/webp(?:\s*;|$)/i.test(request.headers.get('content-type') || ''))
    throw new HttpError(415, 'Send an image in WebP format.');
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_IMAGE_BYTES))
    throw new HttpError(413, 'This image is too large. Choose an image smaller than 2 MB.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Choose an image to upload.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new HttpError(413, 'This image is too large. Choose an image smaller than 2 MB.');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    validateImage(bytes);
    return bytes;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'The image could not be read. Please try again.');
  } finally {
    reader.releaseLock();
  }
}

/** Uploaded images share the existing persistent SQLite database and its backup. */
export class MediaStore {
  constructor(private readonly database: DatabaseSync = getDatabase()) {}

  upload(ownerId: string, bytes: Uint8Array): string {
    if (!OWNER.test(ownerId)) throw new HttpError(401, 'Sign in to upload an image.');
    validateImage(bytes);
    return transaction(this.database, () => {
      const usage = this.database
        .prepare('SELECT coalesce(sum(length(content)), 0) AS bytes FROM media WHERE owner_id = ?')
        .get(ownerId) as { bytes: number };
      if (usage.bytes + bytes.byteLength > ACCOUNT_IMAGE_QUOTA_BYTES)
        throw new HttpError(413, 'Your image storage is full. Contact the site administrator.');
      const filename = `${randomUUID()}.webp`;
      this.database
        .prepare('INSERT INTO media(owner_id, filename, content, created_at) VALUES (?, ?, ?, ?)')
        .run(ownerId, filename, bytes, Date.now());
      return `media:${ownerId}/${filename}`;
    });
  }

  read(ownerId: string, filename: string, viewerId: string | null): Uint8Array<ArrayBuffer> {
    const unavailable = () => new HttpError(404, 'This image is not available.');
    if (!OWNER.test(ownerId) || !FILENAME.test(filename)) throw unavailable();
    const source = `media:${ownerId}/${filename}`;
    // Check the current profile every time. Unpublishing or removing an image
    // immediately revokes anonymous access, including previously known URLs.
    const row = this.database
      .prepare(
        `SELECT media.content FROM media
         JOIN profiles ON profiles.id = media.owner_id
         WHERE media.owner_id = ? AND media.filename = ? AND (
           media.owner_id = ? OR (
             json_extract(profiles.document, '$.published') = 1 AND (
               json_extract(profiles.document, '$.avatarUrl') = ? OR
               json_extract(profiles.document, '$.appearance.backgroundImageUrl') = ?
             )
           )
         )`,
      )
      .get(ownerId, filename, viewerId, source, source) as { content: Uint8Array } | undefined;
    if (!row) throw unavailable();
    return new Uint8Array(row.content);
  }
}
