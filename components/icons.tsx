import { Globe, Mail } from 'lucide-react';
import { faGithub } from '@fortawesome/free-brands-svg-icons/faGithub';
import { faInstagram } from '@fortawesome/free-brands-svg-icons/faInstagram';
import { faLinkedin } from '@fortawesome/free-brands-svg-icons/faLinkedin';
import { faSpotify } from '@fortawesome/free-brands-svg-icons/faSpotify';
import { faTiktok } from '@fortawesome/free-brands-svg-icons/faTiktok';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons/faWhatsapp';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons/faXTwitter';
import { faYoutube } from '@fortawesome/free-brands-svg-icons/faYoutube';
import type { Platform } from '@/lib/types';

// Individual imports keep only the eight brand marks in the browser bundle.
const brandIcons = {
  instagram: faInstagram,
  youtube: faYoutube,
  twitter: faXTwitter,
  tiktok: faTiktok,
  spotify: faSpotify,
  github: faGithub,
  linkedin: faLinkedin,
  whatsapp: faWhatsapp,
};

export function PlatformIcon({ platform, size = 21 }: { platform: Platform; size?: number }) {
  if (platform === 'mail') return <Mail size={size} strokeWidth={1.7} aria-hidden="true" />;
  if (platform === 'website') return <Globe size={size} strokeWidth={1.7} aria-hidden="true" />;
  const brand = brandIcons[platform];
  if (!brand) return <Globe size={size} strokeWidth={1.7} aria-hidden="true" />;
  const [width, height, , , path] = brand.icon;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${width} ${height}`}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      data-platform={platform}
    >
      <metadata>
        Font Awesome Free 7.3.1 by Fonticons, Inc. — https://fontawesome.com — CC BY 4.0
        (https://creativecommons.org/licenses/by/4.0/). Original brand artwork; display color and
        size follow the page theme.
      </metadata>
      {(Array.isArray(path) ? path : [path]).map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
}
