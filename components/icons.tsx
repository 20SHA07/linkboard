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

export function WhatsAppIcon({ size = 21 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.7 8.7 0 0 1-9 9 9.5 9.5 0 0 1-4.2-1L3 21l1.5-4.8A9.5 9.5 0 0 1 3.5 12a8.7 8.7 0 0 1 9-9H13a8.7 8.7 0 0 1 8 8v.5Z" />
      <path d="m8.4 7.2 1.2 2.3-1 1.1c.7 1.7 2 3 3.7 3.7l1.1-1 2.3 1.2c.3.2.4.6.2.9-.5 1-1.6 1.5-2.7 1.2a9.2 9.2 0 0 1-6.4-6.4c-.3-1.1.2-2.2 1.2-2.7.2-.1.3-.2.4-.3Z" />
    </svg>
  );
}

export function PlatformIcon({ platform, size = 21 }: { platform: Platform; size?: number }) {
  if (platform === 'whatsapp') return <WhatsAppIcon size={size} />;
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
