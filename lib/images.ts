'use client';

import { useEffect, useState } from 'react';
import { resolveImageUrl } from './data';
import { safeAvatarUrl } from './validation';

export type ImageKind = 'avatar' | 'background';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;

/** Resolve private storage references without retaining a previous account's image. */
export function useImageUrl(source: string | undefined): string {
  const value = source || '';
  const [result, setResult] = useState<{ source: string; url: string } | null>(null);
  useEffect(() => {
    if (!value || !safeAvatarUrl(value) || /^https:\/\//i.test(value)) return;
    let active = true;
    const refresh = () => {
      void resolveImageUrl(value)
        .then((url) => {
          if (active) setResult({ source: value, url });
        })
        .catch(() => {
          if (active) setResult({ source: value, url: '' });
        });
    };
    refresh();
    // Signed storage links expire after five minutes. Refresh before expiry so
    // images remain usable while someone edits a profile or leaves a page open.
    const interval = window.setInterval(refresh, 240_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [value]);
  if (!safeAvatarUrl(value)) return '';
  if (/^https:\/\//i.test(value)) return value;
  return result?.source === value ? result.url : '';
}

export function imageDimensions(width: number, height: number, kind: ImageKind) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 16_384 ||
    height > 16_384 ||
    width * height > MAX_IMAGE_PIXELS
  )
    throw new Error('This image is too large to edit safely. Choose an image under 40 megapixels.');
  const scale = Math.min(1, (kind === 'avatar' ? 768 : 1920) / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Check real headers before decoding so small compressed files cannot allocate huge canvases. */
export function inspectImage(bytes: Uint8Array, mime: string): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  if (
    mime === 'image/png' &&
    bytes.length >= 33 &&
    bytes[0] === 137 &&
    ascii(1, 3) === 'PNG' &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10 &&
    view.getUint32(8) === 13 &&
    ascii(12, 4) === 'IHDR'
  )
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (mime === 'image/jpeg' && bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker) && length >= 8)
        return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
      offset += length;
    }
  }
  if (
    mime === 'image/webp' &&
    bytes.length >= 30 &&
    ascii(0, 4) === 'RIFF' &&
    ascii(8, 4) === 'WEBP'
  ) {
    const format = ascii(12, 4);
    const uint24 = (offset: number) =>
      bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65_536;
    if (format === 'VP8X') return { width: uint24(24) + 1, height: uint24(27) + 1 };
    if (format === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42)
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    if (format === 'VP8L' && bytes[20] === 47)
      return {
        width: 1 + (((bytes[22] & 63) << 8) | bytes[21]),
        height: 1 + (((bytes[24] & 15) << 10) | (bytes[23] << 2) | (bytes[22] >> 6)),
      };
  }
  throw new Error('Choose a valid JPEG, PNG, or WebP image. Other file types are not supported.');
}

async function decodeImage(
  file: Blob,
): Promise<{ image: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Older browsers may support Image decoding without ImageBitmap for this format.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('This image could not be opened. Try another image.'));
      image.src = url;
    });
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Re-encode uploads to strip metadata and keep storage and mobile downloads small. */
export async function prepareImage(file: Blob, kind: ImageKind): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (!file.size || file.size > MAX_IMAGE_BYTES)
    throw new Error('Choose an image smaller than 10 MB.');
  const header = inspectImage(new Uint8Array(await file.arrayBuffer()), file.type);
  imageDimensions(header.width, header.height, kind);
  const decoded = await decodeImage(file);
  const canvas = document.createElement('canvas');
  try {
    const dimensions = imageDimensions(decoded.width, decoded.height, kind);
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Your browser could not prepare this image. Try a newer browser.');
    for (const quality of [0.86, 0.72, 0.58]) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(decoded.image, 0, 0, canvas.width, canvas.height);
      const output = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );
      if (!output || output.type !== 'image/webp')
        throw new Error(
          'Your browser cannot prepare WebP uploads. Try a newer browser or use an image URL.',
        );
      if (output.size && output.size <= MAX_UPLOAD_BYTES) return output;
    }
    throw new Error('This image is still too large after compression. Choose a smaller image.');
  } finally {
    decoded.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
