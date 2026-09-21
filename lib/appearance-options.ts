import type { ProfileAppearance } from './types';

export const profileFonts = [
  { value: 'dm-sans', label: 'DM Sans', family: "'DM Sans Variable', sans-serif" },
  { value: 'manrope', label: 'Manrope', family: "'Manrope Variable', sans-serif" },
  { value: 'system', label: 'System sans', family: 'system-ui, sans-serif' },
  { value: 'serif', label: 'Classic serif', family: 'Georgia, Cambria, serif' },
  { value: 'mono', label: 'Monospace', family: "'Courier New', monospace" },
] as const;

export const appearanceColors = [
  'textColor',
  'headingColor',
  'linkTextColor',
  'linkBackgroundColor',
  'linkBorderColor',
  'avatarBorderColor',
  'backgroundGradientColor',
] as const satisfies readonly (keyof ProfileAppearance)[];

export const appearanceNumbers = {
  backgroundOverlay: [0, 80],
  backgroundGradientAngle: [0, 360],
  headingSize: [20, 56],
  bioSize: [12, 24],
  linkFontSize: [12, 24],
  avatarSize: [48, 200],
  avatarBorderWidth: [0, 8],
  linkRadius: [0, 32],
  linkBorderWidth: [0, 4],
  linkGap: [6, 32],
  linkPadding: [12, 28],
  contentWidth: [320, 720],
  contentPadding: [16, 96],
} as const;

export const appearanceEnums = {
  backgroundPosition: ['top', 'center', 'bottom'],
  avatarPosition: ['top', 'center', 'bottom'],
  backgroundFit: ['cover', 'contain'],
  fontFamily: profileFonts.map((font) => font.value),
  headingFontFamily: profileFonts.map((font) => font.value),
  headingWeight: [400, 500, 600, 700, 800],
  avatarShape: ['circle', 'rounded', 'square'],
  textAlign: ['left', 'center', 'right'],
  linkAlign: ['left', 'center', 'right'],
  linkStyle: ['filled', 'outline', 'glass'],
  linkShadow: ['none', 'soft', 'bold'],
} as const;

export const appearanceBooleans = [
  'dashboardBackground',
  'showAvatar',
  'showBranding',
  'showQrCode',
  'showLinkIcons',
  'showLinkArrows',
] as const;

export const appearanceKeys = [
  'backgroundImageUrl',
  ...appearanceColors,
  ...Object.keys(appearanceNumbers),
  ...Object.keys(appearanceEnums),
  ...appearanceBooleans,
] as readonly (keyof ProfileAppearance)[];
