'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Copy, Link2, RefreshCw } from 'lucide-react';
import { getPublicProfile, trackClick } from '@/lib/data';
import type { Profile } from '@/lib/types';
import ProfileCard, { ProfileBackground, profileThemeStyle } from '@/components/profile-card';
import QRCode from '@/components/qr-code';
import { publicProfileUrl } from '@/lib/urls';

export default function PublicProfile({ username }: { username: string }) {
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    profile: Profile | null;
    error: boolean;
    url: string;
  } | null>(null);
  const requestKey = `${retry}:${username}`;
  const loading = result?.key !== requestKey;
  const profile = loading ? null : result?.profile;
  const error = !loading && result?.error;
  const url = loading ? '' : result?.url || '';
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    let active = true;
    getPublicProfile(username)
      .then((result) => {
        if (!active) return;
        setResult({
          key: requestKey,
          profile: result,
          error: false,
          url: result ? publicProfileUrl(result.username, window.location.origin) : '',
        });
        setCopied(false);
        setCopyError(false);
      })
      .catch(() => {
        if (active) setResult({ key: requestKey, profile: null, error: true, url: '' });
      });
    return () => {
      active = false;
    };
  }, [username, requestKey]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  const background = profile ? profileThemeStyle(profile) : undefined;

  return (
    <div
      className={`public-page profile-image-background theme-${profile?.theme || 'sand'}`}
      style={background}
    >
      <ProfileBackground
        source={profile?.appearance?.backgroundImageUrl}
        position={profile?.appearance?.backgroundPosition}
        overlay={profile?.appearance?.backgroundOverlay}
      />
      <header className="public-header">
        <Link href="/" className="public-wordmark">
          <Link2 size={23} strokeWidth={2.3} aria-hidden="true" />
          linkboard<span className="public-wordmark-dot">.</span>
        </Link>
        <Link href="/" className="public-create-link">
          Make it yours <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </header>
      <main className="public-main">
        {loading ? (
          <div className="public-loading" role="status">
            <div className="public-skeleton-avatar" />
            <div className="public-skeleton-title" />
            <div className="public-skeleton-bio" />
            {[0, 1, 2].map((item) => (
              <div className="public-skeleton-link" key={item} />
            ))}
            <span className="visually-hidden">Loading profile…</span>
          </div>
        ) : error ? (
          <section className="public-message">
            <span className="public-message-eyebrow">A little interruption</span>
            <h1>This page couldn’t load.</h1>
            <p>Check your connection and give it another try.</p>
            <button
              type="button"
              className="public-action"
              onClick={() => setRetry((value) => value + 1)}
            >
              <RefreshCw size={16} aria-hidden="true" /> Try again
            </button>
          </section>
        ) : !profile || !profile.published ? (
          <section className="public-message">
            <span className="public-message-eyebrow">Not here, just yet</span>
            <h1>This page isn’t available.</h1>
            <p>The address may have changed, or its owner hasn’t published it yet.</p>
            <Link href="/" className="public-action">
              Back to linkboard <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </section>
        ) : (
          <>
            <ProfileCard
              profile={profile}
              backgroundHandled
              onLinkClick={(linkId) => {
                void trackClick(profile.id, linkId).catch(() => {
                  /* Navigation remains available when analytics is offline. */
                });
              }}
            />
            <section className="public-share" aria-labelledby="share-heading">
              <div className="public-share-copy">
                <span className="public-share-eyebrow">Good things are worth sharing</span>
                <h2 id="share-heading">Take this page with you.</h2>
                <p>Scan the code to open this page, or save it for later.</p>
                <button className="public-copy-button" type="button" onClick={() => void copyUrl()}>
                  {copied ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <Copy size={15} aria-hidden="true" />
                  )}
                  {copied ? 'Copied!' : 'Copy page link'}
                </button>
                <span className="visually-hidden" role="status">
                  {copied ? 'Profile link copied to clipboard.' : ''}
                </span>
                {copyError && (
                  <p className="public-copy-error" role="status">
                    Copy this link: <a href={url}>{url}</a>
                  </p>
                )}
              </div>
              {url && <QRCode url={url} name={profile.username} size={136} />}
            </section>
          </>
        )}
      </main>
      <footer className="public-footer">A little corner of the internet. All yours.</footer>
    </div>
  );
}
