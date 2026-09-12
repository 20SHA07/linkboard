import {
  Globe,
  Instagram,
  Youtube,
  Github,
  Linkedin,
  Music2,
  Mail,
  AudioLines,
} from 'lucide-react';
import type { Platform } from '@/lib/types';
export function PlatformIcon({ platform, size = 21 }: { platform: Platform; size?: number }) {
  const icons = {
    website: Globe,
    instagram: Instagram,
    youtube: Youtube,
    github: Github,
    linkedin: Linkedin,
    spotify: AudioLines,
    tiktok: Music2,
    mail: Mail,
  };
  if (platform === 'twitter')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l7.9-9L.8 2h6.5l4.5 6.8L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z" />
      </svg>
    );
  const Icon = icons[platform] || Globe;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}
