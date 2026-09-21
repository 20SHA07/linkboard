'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { Profile } from '@/lib/types';
import { safeUrl } from '@/lib/validation';
import { useImageUrl } from '@/lib/images';
import { profileAppearanceStyles } from '@/lib/appearance';
import { AnimatedGroup } from './motion/animated-group';
import { PlatformIcon } from './icons';

/** A decorative layer shared by public pages, previews, and the dashboard. */
export function ProfileBackground({
  source,
  position = 'center',
  overlay = 45,
  fit = 'cover',
  onReadyChange,
}: {
  source?: string;
  position?: 'top' | 'center' | 'bottom';
  overlay?: number;
  fit?: 'cover' | 'contain';
  onReadyChange?: (ready: boolean) => void;
}) {
  const url = useImageUrl(source);
  const [loadedUrl, setLoadedUrl] = useState('');
  const [failedUrl, setFailedUrl] = useState('');
  const ready = !!url && loadedUrl === url && failedUrl !== url;
  useEffect(() => {
    onReadyChange?.(ready);
    return () => onReadyChange?.(false);
  }, [ready, onReadyChange]);
  if (!url || failedUrl === url) return null;
  return (
    <div className={`profile-background${ready ? ' is-ready' : ''}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        style={{
          objectPosition: `center ${['top', 'center', 'bottom'].includes(position) ? position : 'center'}`,
          objectFit: fit === 'contain' ? 'contain' : 'cover',
        }}
        onLoad={() => setLoadedUrl(url)}
        onError={() => setFailedUrl(url)}
        referrerPolicy="no-referrer"
      />
      <div
        className="profile-background-overlay"
        style={{
          opacity: Math.min(80, Math.max(0, Number.isFinite(overlay) ? overlay : 45)) / 100,
        }}
      />
    </div>
  );
}

/** Choose the more legible foreground using WCAG relative luminance. */
export function profileThemeStyle(
  profile: Pick<Profile, 'theme' | 'backgroundColor'>,
): CSSProperties | undefined {
  if (profile.theme !== 'custom' || !/^#[\da-f]{6}$/i.test(profile.backgroundColor))
    return undefined;
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((start) => {
      const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const background = luminance(profile.backgroundColor);
  const dark = luminance('#283329');
  const light = luminance('#f9f8f2');
  const contrast = (first: number, second: number) =>
    (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  let useDarkText = contrast(background, dark) >= contrast(background, light);
  let foreground = useDarkText ? '#283329' : '#f9f8f2';
  if (contrast(background, useDarkText ? dark : light) < 4.5) {
    useDarkText = contrast(background, 0) >= contrast(background, 1);
    foreground = useDarkText ? '#000000' : '#ffffff';
  }
  return {
    backgroundColor: profile.backgroundColor,
    color: foreground,
    '--profile-link-bg': useDarkText ? 'rgba(255,255,255,.75)' : 'rgba(0,0,0,.24)',
    '--profile-link-border': useDarkText ? 'rgba(40,51,41,.12)' : 'rgba(255,255,255,.18)',
  } as CSSProperties;
}

export default function ProfileCard({
  profile,
  compact = false,
  onLinkClick,
  showBrand = true,
  backgroundHandled = false,
}: {
  profile: Profile;
  compact?: boolean;
  onLinkClick?: (linkId: string) => void;
  showBrand?: boolean;
  backgroundHandled?: boolean;
}) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const avatarUrl = useImageUrl(profile.avatarUrl);
  const initials =
    profile.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || 'L';
  const avatarVisible = avatarUrl && failedAvatar !== avatarUrl;
  const links = profile.links.filter((link) => link.enabled && safeUrl(link.url));
  const appearance = profileAppearanceStyles(profile, compact);
  const customBackground = { ...profileThemeStyle(profile), ...appearance.surface };
  if (backgroundHandled) {
    delete customBackground.backgroundColor;
    delete customBackground.backgroundImage;
  }
  const Heading = compact ? 'h2' : 'h1';
  const recordClick = (linkId: string) => {
    // Tracking must never prevent a visitor from reaching the destination.
    try {
      onLinkClick?.(linkId);
    } catch {
      /* Best-effort analytics. */
    }
  };

  return (
    <section
      className={`profile-card profile-image-background theme-${profile.theme}${compact ? ' profile-card-compact' : ''}`}
      style={customBackground}
      aria-label={`${profile.name || profile.username}'s links`}
    >
      {!backgroundHandled && (
        <ProfileBackground
          source={profile.appearance?.backgroundImageUrl}
          position={profile.appearance?.backgroundPosition}
          overlay={profile.appearance?.backgroundOverlay}
          fit={profile.appearance?.backgroundFit}
        />
      )}
      {profile.appearance?.showAvatar !== false && (
        <div className="profile-avatar" style={appearance.avatar}>
          {avatarVisible ? (
            // Native images support validated avatar URLs from any HTTPS host.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={profile.name || profile.username}
              style={{
                objectPosition: `center ${['top', 'center', 'bottom'].includes(profile.appearance?.avatarPosition || '') ? profile.appearance?.avatarPosition : 'center'}`,
              }}
              onError={() => setFailedAvatar(avatarUrl)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span aria-label={`${profile.name || profile.username}'s initials`}>{initials}</span>
          )}
        </div>
      )}
      <Heading className="profile-name" style={appearance.heading}>
        {profile.name || profile.username}
      </Heading>
      {profile.bio && (
        <p className="profile-bio" style={appearance.bio}>
          {profile.bio}
        </p>
      )}
      <AnimatedGroup className="profile-links" disabled={compact}>
        {links.map((link) => {
          return (
            <a
              className="profile-link"
              style={appearance.link}
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordClick(link.id)}
              onAuxClick={(event) => {
                // Middle-button navigation fires auxclick, not click. Right-click
                // only opens a context menu and must not increment analytics.
                if (event.button === 1) recordClick(link.id);
              }}
              aria-label={`${link.title || link.platform} (opens in a new tab)`}
            >
              {profile.appearance?.showLinkIcons !== false && (
                <span className={`platform-icon platform-${link.platform}`}>
                  <PlatformIcon platform={link.platform} size={19} />
                </span>
              )}
              <span className="profile-link-title">{link.title || link.platform}</span>
              {profile.appearance?.showLinkArrows !== false && (
                <ExternalLink
                  className="profile-link-arrow"
                  size={15}
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
              )}
            </a>
          );
        })}
        {links.length === 0 && (
          <p className="profile-empty">Something good is on the way. Check back soon.</p>
        )}
      </AnimatedGroup>
      {showBrand && profile.appearance?.showBranding !== false && (
        <Link className="profile-brand" href="/">
          Made with <strong>linkboard</strong>
          <span aria-hidden="true">↗</span>
        </Link>
      )}
    </section>
  );
}
