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
export type ProfileFont = 'dm-sans' | 'manrope' | 'system' | 'serif' | 'mono';
export type ProfileAlignment = 'left' | 'center' | 'right';
export interface ProfileAppearance {
  backgroundImageUrl?: string;
  backgroundPosition?: ImagePosition;
  backgroundOverlay?: number;
  avatarPosition?: ImagePosition;
  dashboardBackground?: boolean;
  backgroundFit?: 'cover' | 'contain';
  backgroundGradientColor?: string;
  backgroundGradientAngle?: number;
  textColor?: string;
  headingColor?: string;
  linkTextColor?: string;
  linkBackgroundColor?: string;
  linkBorderColor?: string;
  avatarBorderColor?: string;
  fontFamily?: ProfileFont;
  headingFontFamily?: ProfileFont;
  headingWeight?: 400 | 500 | 600 | 700 | 800;
  headingSize?: number;
  bioSize?: number;
  linkFontSize?: number;
  avatarSize?: number;
  avatarShape?: 'circle' | 'rounded' | 'square';
  avatarBorderWidth?: number;
  textAlign?: ProfileAlignment;
  linkAlign?: ProfileAlignment;
  linkStyle?: 'filled' | 'outline' | 'glass';
  linkShadow?: 'none' | 'soft' | 'bold';
  linkRadius?: number;
  linkBorderWidth?: number;
  linkGap?: number;
  linkPadding?: number;
  contentWidth?: number;
  contentPadding?: number;
  showAvatar?: boolean;
  showBranding?: boolean;
  showQrCode?: boolean;
  showLinkIcons?: boolean;
  showLinkArrows?: boolean;
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
