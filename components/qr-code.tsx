'use client';

import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import QRCodeLibrary from 'qrcode';

export default function QRCode({
  url,
  name = 'profile',
  size = 160,
  downloadable = true,
}: {
  url: string;
  name?: string;
  size?: number;
  downloadable?: boolean;
}) {
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; image: string; error: string } | null>(null);
  const requestKey = `${retry}:${url}`;
  const image = result?.key === requestKey ? result.image : '';
  const error = result?.key === requestKey ? result.error : '';
  const displaySize = Number.isFinite(size) ? Math.max(96, Math.min(512, size)) : 160;

  useEffect(() => {
    let active = true;
    async function generate() {
      try {
        const parsed = new URL(url);
        if (!['https:', 'http:'].includes(parsed.protocol) || url.length > 2048)
          throw new Error('invalid-url');
        const result = await QRCodeLibrary.toDataURL(parsed.href, {
          type: 'image/png',
          width: 1024,
          margin: 4,
          errorCorrectionLevel: 'M',
          color: { dark: '#17241cff', light: '#ffffffff' },
        });
        if (active) setResult({ key: requestKey, image: result, error: '' });
      } catch {
        if (active)
          setResult({
            key: requestKey,
            image: '',
            error: 'The QR code could not be generated. You can still share the page link.',
          });
      }
    }
    void generate();
    return () => {
      active = false;
    };
  }, [url, requestKey]);

  const filename = `linkboard-${name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 60) || 'profile'}-qr.png`;

  return (
    <div className="qr-code">
      <div
        className="qr-image-frame"
        style={{ width: displaySize, minHeight: displaySize }}
        aria-busy={!image && !error}
      >
        {image ? (
          // A generated PNG data URL needs no remote image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            width={displaySize}
            height={displaySize}
            alt={`QR code for ${name}'s profile: ${url}`}
          />
        ) : error ? (
          <div className="qr-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)}>
              <RefreshCw size={14} aria-hidden="true" /> Try again
            </button>
          </div>
        ) : (
          <span className="qr-loading" role="status">
            Generating QR code…
          </span>
        )}
      </div>
      {downloadable && image && (
        <a className="qr-download" href={image} download={filename}>
          <Download size={15} aria-hidden="true" /> Download PNG
        </a>
      )}
    </div>
  );
}
