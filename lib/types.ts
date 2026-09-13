export type Platform =
  | 'website'
  | 'instagram'
  | 'youtube'
  | 'twitter'
  | 'tiktok'
  | 'linkedin'
  | 'github'
  | 'spotify'
  | 'whatsapp'
  | 'mail';
export type Theme = 'sand' | 'sage' | 'rose' | 'ink' | 'custom';
export type ImagePosition = 'top' | 'center' | 'bottom';
export interface ProfileAppearance {
  backgroundImageUrl?: string;
  backgroundPosition?: ImagePosition;
  backgroundOverlay?: number;
  avatarPosition?: ImagePosition;
  dashboardBackground?: boolean;
}
export interface SocialLink {
  id: string;
  title: string;
  url: string;
  platform: Platform;
  enabled: boolean;
}
export interface Profile {
  id: string;
  username: string;
  name: string;
  bio: string;
  avatarUrl: string;
  theme: Theme;
  backgroundColor: string;
  appearance?: ProfileAppearance;
  links: SocialLink[];
  published: boolean;
}
export interface ClickEvent {
  id: string;
  linkId: string;
  timestamp: string;
}
export interface Account {
  id: string;
  email: string;
}
