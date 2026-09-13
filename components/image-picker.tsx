'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Trash2, Upload } from 'lucide-react';
import { uploadImage } from '@/lib/data';
import { prepareImage, useImageUrl, type ImageKind } from '@/lib/images';
import { safeAvatarUrl } from '@/lib/validation';

export default function ImagePicker({
  label,
  ownerId,
  value,
  onChange,
  kind,
  onBusyChange,
  disabled = false,
}: {
  label: string;
  ownerId: string;
  value: string;
  onChange: (value: string) => void;
  kind: ImageKind;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef({ generation: 0 });
  const busyHandler = useRef(onBusyChange);
  const [pending, setPending] = useState<{ source: string; label: string } | null>(null);
  const [error, setError] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [failedPreview, setFailedPreview] = useState('');
  const url = useImageUrl(value);
  const busy = pending?.source === value;

  useEffect(() => {
    busyHandler.current = onBusyChange;
  }, [onBusyChange]);

  useEffect(() => {
    const activeOperation = operation.current;
    return () => {
      activeOperation.generation++;
      busyHandler.current?.(false);
    };
  }, [value, ownerId]);

  async function selectFile(file: File | undefined) {
    if (!file || disabled || busy) return;
    const current = ++operation.current.generation;
    const source = value;
    setError('');
    setPending({ source, label: 'Preparing image…' });
    busyHandler.current?.(true);
    try {
      const prepared = await prepareImage(file, kind);
      if (current !== operation.current.generation) return;
      setPending({ source, label: 'Uploading image…' });
      const reference = await uploadImage(prepared, ownerId);
      if (current !== operation.current.generation) return;
      onChange(reference);
      setUrlDraft('');
    } catch (cause) {
      if (current === operation.current.generation)
        setError(
          cause instanceof Error
            ? cause.message
            : 'The image could not be uploaded. Please try again.',
        );
    } finally {
      if (current === operation.current.generation) {
        setPending(null);
        busyHandler.current?.(false);
      }
    }
  }

  function applyUrl() {
    const next = urlDraft.trim();
    if (!/^https:\/\//i.test(next) || !safeAvatarUrl(next)) {
      setError('Paste a full HTTPS image URL, such as https://example.com/photo.jpg.');
      return;
    }
    setError('');
    onChange(next);
    setUrlDraft('');
  }

  return (
    <fieldset
      className={`image-picker image-picker-${kind}`}
      disabled={disabled || busy}
      aria-busy={busy}
    >
      <legend>{label}</legend>
      <div className="image-picker-selection">
        <div className="image-picker-preview">
          {url && failedPreview !== url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={`${label} preview`}
              referrerPolicy="no-referrer"
              onError={() => setFailedPreview(url)}
            />
          ) : (
            <ImagePlus size={25} aria-hidden="true" />
          )}
        </div>
        <div className="image-picker-actions">
          <input
            ref={input}
            id={`${id}-file`}
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={`Upload ${label.toLowerCase()}`}
            aria-describedby={`${id}-help`}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              void selectFile(file);
            }}
          />
          <button type="button" className="secondary-button" onClick={() => input.current?.click()}>
            {busy ? (
              <LoaderCircle size={15} className="spin" aria-hidden="true" />
            ) : (
              <Upload size={15} aria-hidden="true" />
            )}
            {busy ? pending.label : value ? 'Replace image' : 'Upload image'}
          </button>
          {value && (
            <button
              type="button"
              className="image-picker-remove"
              onClick={() => {
                setError('');
                onChange('');
              }}
            >
              <Trash2 size={14} aria-hidden="true" /> Remove
            </button>
          )}
          <p id={`${id}-help`}>
            JPEG, PNG, or WebP. Up to 10 MB. Images are resized automatically.
          </p>
        </div>
      </div>
      <details className="image-picker-url">
        <summary>Use an image URL instead</summary>
        <label htmlFor={`${id}-url`}>{label} URL</label>
        <div className="image-picker-url-row">
          <input
            id={`${id}-url`}
            type="url"
            value={urlDraft}
            placeholder="https://example.com/image.jpg"
            autoComplete="off"
            maxLength={2048}
            onChange={(event) => setUrlDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyUrl();
              }
            }}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={applyUrl}
            disabled={!urlDraft.trim()}
          >
            Use URL
          </button>
        </div>
      </details>
      {error && (
        <p className="image-picker-error" role="alert">
          {error}
        </p>
      )}
      {value && url && failedPreview === url && (
        <p className="image-picker-error" role="status">
          The image could not load. Replace it or check that its URL is publicly accessible.
        </p>
      )}
      <span className="visually-hidden" role="status">
        {busy ? pending.label : ''}
      </span>
    </fieldset>
  );
}
