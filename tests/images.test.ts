import { describe, expect, it, vi } from 'vitest';
vi.mock('../lib/data', () => ({ resolveImageUrl: vi.fn() }));
import { imageDimensions, inspectImage, MAX_IMAGE_BYTES, prepareImage } from '../lib/images';

function png(width: number, height: number) {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function webp(format: string) {
  const bytes = new Uint8Array(32);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  bytes.set(new TextEncoder().encode('WEBP'), 8);
  bytes.set(new TextEncoder().encode(format), 12);
  return bytes;
}

describe('image upload dimensions', () => {
  it('preserves aspect ratio and caps avatar and background resolution', () => {
    expect(imageDimensions(4000, 3000, 'avatar')).toEqual({ width: 768, height: 576 });
    expect(imageDimensions(3000, 4000, 'background')).toEqual({ width: 1440, height: 1920 });
  });
  it('does not upscale small images or lose a narrow dimension', () => {
    expect(imageDimensions(100, 50, 'avatar')).toEqual({ width: 100, height: 50 });
    expect(imageDimensions(16_000, 1, 'background')).toEqual({ width: 1920, height: 1 });
  });
  it.each([
    [0, 100],
    [-1, 100],
    [1.5, 20],
    [Infinity, 10],
    [20_000, 1],
    [8000, 6000],
  ])('rejects dangerous dimensions %i × %i before decoding', (width, height) => {
    expect(() => imageDimensions(width, height, 'background')).toThrow();
  });
});

describe('image header verification', () => {
  it('reads PNG dimensions only from a PNG header', () => {
    expect(inspectImage(png(2400, 1800), 'image/png')).toEqual({ width: 2400, height: 1800 });
    expect(() => inspectImage(png(2400, 1800), 'image/jpeg')).toThrow();
  });
  it('reads JPEG SOF dimensions past an application metadata segment', () => {
    const bytes = new Uint8Array([
      255, 216, 255, 225, 0, 4, 1, 2, 255, 194, 0, 8, 8, 1, 44, 2, 88, 3,
    ]);
    expect(inspectImage(bytes, 'image/jpeg')).toEqual({ width: 600, height: 300 });
  });
  it('reads extended WebP dimensions', () => {
    const bytes = webp('VP8X');
    bytes.set([255, 3, 0], 24);
    bytes.set([255, 1, 0], 27);
    expect(inspectImage(bytes, 'image/webp')).toEqual({ width: 1024, height: 512 });
  });
  it('reads lossy WebP dimensions', () => {
    const bytes = webp('VP8 ');
    bytes.set([157, 1, 42], 23);
    const view = new DataView(bytes.buffer);
    view.setUint16(26, 640, true);
    view.setUint16(28, 480, true);
    expect(inspectImage(bytes, 'image/webp')).toEqual({ width: 640, height: 480 });
  });
  it('reads lossless WebP dimensions', () => {
    const bytes = webp('VP8L');
    bytes[20] = 47;
    const packed = ((640 - 1) | ((480 - 1) << 14)) >>> 0;
    new DataView(bytes.buffer).setUint32(21, packed, true);
    expect(inspectImage(bytes, 'image/webp')).toEqual({ width: 640, height: 480 });
  });
  it('rejects truncated or spoofed files and invalid JPEG segment lengths', () => {
    for (const bytes of [
      new Uint8Array(),
      new TextEncoder().encode('<svg onload="alert(1)"/>'),
      new Uint8Array([255, 216, 255, 225, 0, 0]),
    ]) {
      expect(() => inspectImage(bytes, 'image/jpeg')).toThrow();
    }
    expect(() => inspectImage(png(100, 100).subarray(0, 20), 'image/png')).toThrow();
  });
});

describe('image processing limits', () => {
  it('rejects unsupported and empty uploads before using browser APIs', async () => {
    await expect(
      prepareImage(new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'avatar'),
    ).rejects.toThrow('JPEG');
    await expect(prepareImage(new Blob([], { type: 'image/png' }), 'avatar')).rejects.toThrow(
      '10 MB',
    );
  });
  it('rejects oversized uploads before reading or decoding them', async () => {
    const file = new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], { type: 'image/png' });
    const read = vi.spyOn(file, 'arrayBuffer');
    await expect(prepareImage(file, 'avatar')).rejects.toThrow('10 MB');
    expect(read).not.toHaveBeenCalled();
  });
  it('rejects compressed images with excessive decoded pixels', async () => {
    await expect(
      prepareImage(new Blob([png(16_000, 16_000)], { type: 'image/png' }), 'background'),
    ).rejects.toThrow('40 megapixels');
  });
});
