import type { CSSProperties } from 'react';
import { appearanceNumbers, profileFonts } from './appearance-options';
import type { Profile, ProfileAppearance } from './types';

type ProfileStyles = CSSProperties & Record<`--${string}`, string | number | undefined>;

const themeColors: Record<Profile['theme'], string> = {
  sand: '#ede7db',
  sage: '#dce5d8',
  rose: '#eeddda',
  ink: '#282e2c',
  custom: '#ede7db',
};

/** Render only our supported values, even if a legacy or public response is malformed. */
export function profileAppearanceStyles(
  profile: Pick<Profile, 'appearance' | 'theme' | 'backgroundColor'>,
  compact = false,
) {
  const a: ProfileAppearance =
    profile.appearance &&
    typeof profile.appearance === 'object' &&
    !Array.isArray(profile.appearance)
      ? profile.appearance
      : {};
  const scale = compact ? 0.78 : 1;
  const color = (value: unknown) =>
    typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : undefined;
  const number = (key: keyof typeof appearanceNumbers) => {
    const value = a[key];
    const [min, max] = appearanceNumbers[key];
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : undefined;
  };
  const pixels = (key: keyof typeof appearanceNumbers) => {
    const value = number(key);
    return value === undefined ? undefined : Math.round(value * scale * 100) / 100;
  };
  const font = (value: unknown) => profileFonts.find((entry) => entry.value === value)?.family;
  const textAlign = ['left', 'center', 'right'].includes(a.textAlign || '')
    ? a.textAlign
    : undefined;
  const linkAlign = ['left', 'center', 'right'].includes(a.linkAlign || '')
    ? a.linkAlign
    : undefined;
  const baseColor =
    profile.theme === 'custom'
      ? color(profile.backgroundColor) || themeColors.sand
      : themeColors[profile.theme] || themeColors.sand;
  const gradientColor = color(a.backgroundGradientColor);
  const gradientAngle = number('backgroundGradientAngle') ?? 135;
  const bodyColor = color(a.textColor);
  const page: ProfileStyles = {
    color: bodyColor,
    '--profile-text-color': bodyColor,
    fontFamily: font(a.fontFamily),
    backgroundImage: gradientColor
      ? `linear-gradient(${gradientAngle}deg, ${baseColor}, ${gradientColor})`
      : undefined,
  };
  const surface: ProfileStyles = {
    ...page,
    textAlign,
    alignItems:
      textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : undefined,
    paddingTop: pixels('contentPadding'),
    '--profile-link-gap': pixels('linkGap') === undefined ? undefined : `${pixels('linkGap')}px`,
    '--profile-content-width':
      pixels('contentWidth') === undefined ? undefined : `${pixels('contentWidth')}px`,
  };
  const avatarSize = pixels('avatarSize');
  const avatar: CSSProperties = {
    width: avatarSize,
    height: avatarSize,
    fontSize: avatarSize === undefined ? undefined : avatarSize * 0.28,
    borderRadius:
      a.avatarShape === 'square'
        ? 0
        : a.avatarShape === 'rounded'
          ? '22%'
          : a.avatarShape === 'circle'
            ? '50%'
            : undefined,
    borderWidth: pixels('avatarBorderWidth'),
    borderColor: color(a.avatarBorderColor),
  };
  const heading: CSSProperties = {
    color: color(a.headingColor),
    fontFamily: font(a.headingFontFamily),
    fontSize: pixels('headingSize'),
    fontWeight: [400, 500, 600, 700, 800].includes(a.headingWeight ?? 0)
      ? a.headingWeight
      : undefined,
  };
  const bio: CSSProperties = {
    color: bodyColor,
    opacity: bodyColor ? 1 : undefined,
    fontSize: pixels('bioSize'),
    marginLeft: textAlign === 'left' ? 0 : textAlign === 'right' ? 'auto' : undefined,
    marginRight: textAlign === 'right' ? 0 : textAlign === 'left' ? 'auto' : undefined,
  };
  const link: CSSProperties = {
    color: color(a.linkTextColor),
    backgroundColor: color(a.linkBackgroundColor),
    borderColor: color(a.linkBorderColor),
    fontSize: pixels('linkFontSize'),
    borderRadius: pixels('linkRadius'),
    borderWidth: pixels('linkBorderWidth'),
    textAlign: linkAlign,
    padding:
      pixels('linkPadding') === undefined
        ? undefined
        : `${pixels('linkPadding')}px ${pixels('linkPadding')! + 2 * scale}px`,
    boxShadow:
      a.linkShadow === 'none'
        ? 'none'
        : a.linkShadow === 'soft'
          ? '0 4px 12px #00000014'
          : a.linkShadow === 'bold'
            ? '4px 4px 0 #00000040'
            : undefined,
  };
  if (a.linkStyle === 'outline') {
    link.backgroundColor = 'transparent';
    link.color ||= 'inherit';
    link.borderColor ||= 'currentColor';
  } else if (a.linkStyle === 'glass') {
    link.backgroundColor = `color-mix(in srgb, ${color(a.linkBackgroundColor) || 'var(--profile-link-bg, #fffdf6)'} 28%, transparent)`;
    link.color ||= 'inherit';
    link.backdropFilter = 'blur(12px)';
    link.WebkitBackdropFilter = 'blur(12px)';
  }
  const content: CSSProperties = {
    width:
      number('contentWidth') === undefined
        ? undefined
        : `min(100% - 40px, ${number('contentWidth')}px)`,
  };
  const defined = <T extends CSSProperties>(style: T): T =>
    Object.fromEntries(Object.entries(style).filter(([, value]) => value !== undefined)) as T;
  return {
    page: defined(page),
    surface: defined(surface),
    avatar: defined(avatar),
    heading: defined(heading),
    bio: defined(bio),
    link: defined(link),
    content: defined(content),
  };
}
