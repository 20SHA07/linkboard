'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  Music2,
  Twitter,
  Youtube,
} from 'lucide-react';
import type { Platform, Profile } from '@/lib/types';
import { safeAvatarUrl, safeUrl } from '@/lib/validation';

const platformIcons = {
  website: Globe,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
  tiktok: Music2,
  linkedin: Linkedin,
  github: Github,
  spotify: Music2,
  mail: Mail,
} satisfies Record<Platform, typeof Globe>;

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
}: {
  profile: Profile;
  compact?: boolean;
  onLinkClick?: (linkId: string) => void;
  showBrand?: boolean;
}) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const initials =
    profile.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || 'L';
  const avatarVisible =
    profile.avatarUrl && failedAvatar !== profile.avatarUrl && safeAvatarUrl(profile.avatarUrl);
  const links = profile.links.filter((link) => link.enabled && safeUrl(link.url));
  const customBackground = profileThemeStyle(profile);
  const Heading = compact ? 'h2' : 'h1';

  return (
    <section
      className={`profile-card theme-${profile.theme}${compact ? ' profile-card-compact' : ''}`}
      style={customBackground}
      aria-label={`${profile.name || profile.username}'s links`}
    >
      <div className="profile-avatar">
        {avatarVisible ? (
          // Native images support validated avatar URLs from any HTTPS host.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={profile.name || profile.username}
            onError={() => setFailedAvatar(profile.avatarUrl)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span aria-label={`${profile.name || profile.username}'s initials`}>{initials}</span>
        )}
      </div>
      <Heading className="profile-name">{profile.name || profile.username}</Heading>
      {profile.bio && <p className="profile-bio">{profile.bio}</p>}
      <div className="profile-links">
        {links.map((link) => {
          const Icon = platformIcons[link.platform] || Globe;
          return (
            <a
              className="profile-link"
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                // Tracking must never prevent a visitor from reaching the destination.
                try {
                  onLinkClick?.(link.id);
                } catch {
                  /* Best-effort analytics. */
                }
              }}
              aria-label={`${link.title || link.platform} (opens in a new tab)`}
            >
              <span className={`platform-icon platform-${link.platform}`}>
                <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span className="profile-link-title">{link.title || link.platform}</span>
              <ExternalLink
                className="profile-link-arrow"
                size={15}
                strokeWidth={1.6}
                aria-hidden="true"
              />
            </a>
          );
        })}
        {links.length === 0 && (
          <p className="profile-empty">Something good is on the way. Check back soon.</p>
        )}
      </div>
      {showBrand && (
        <Link className="profile-brand" href="/">
          Made with <strong>linkboard</strong>
          <span aria-hidden="true">↗</span>
        </Link>
      )}
    </section>
  );
}
