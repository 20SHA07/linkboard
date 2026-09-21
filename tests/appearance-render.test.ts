import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProfileAppearance } from '../lib/types';
import { profileAppearanceStyles } from '../lib/appearance';
import { testProfile } from './fixtures';

vi.mock('../lib/images', () => ({ useImageUrl: (source: string | undefined) => source || '' }));
import ProfileCard from '../components/profile-card';

describe('profile appearance rendering', () => {
  it('preserves existing theme styling when no customization is selected', () => {
    expect(profileAppearanceStyles(testProfile)).toEqual({
      page: {},
      surface: {},
      avatar: {},
      heading: {},
      bio: {},
      link: {},
      content: {},
    });
  });

  it('allows only safe colors and bundled font stacks in public styling', () => {
    const styles = profileAppearanceStyles({
      ...testProfile,
      appearance: {
        textColor: 'url(https://example.com/tracker)',
        headingColor: '#c0ffee',
        backgroundGradientColor: 'red; display:none',
        fontFamily: 'external-font',
        headingFontFamily: 'serif',
        avatarShape: 'anything',
        linkAlign: 'anything',
      } as unknown as ProfileAppearance,
    });
    expect(styles.page).toEqual({});
    expect(styles.heading).toEqual({ color: '#c0ffee', fontFamily: 'Georgia, Cambria, serif' });
    expect(styles.avatar).toEqual({});
    expect(styles.link).toEqual({});
  });

  it('keeps the profile-name theme font independent of the body font', () => {
    const styles = profileAppearanceStyles({
      ...testProfile,
      appearance: { fontFamily: 'mono' },
    });
    expect(styles.page.fontFamily).toBe("'Courier New', monospace");
    expect(styles.heading.fontFamily).toBeUndefined();
  });

  it('bounds dimensions and scales compact preview sizes without changing saved data', () => {
    const appearance: ProfileAppearance = {
      avatarSize: 9000,
      headingSize: 1,
      bioSize: 20,
      linkPadding: Infinity,
      contentWidth: 10000,
      contentPadding: NaN,
      avatarBorderWidth: 0,
      linkRadius: 0,
    };
    const normal = profileAppearanceStyles({ ...testProfile, appearance });
    const compact = profileAppearanceStyles({ ...testProfile, appearance }, true);
    expect(normal.avatar).toMatchObject({ width: 200, height: 200, borderWidth: 0 });
    expect(compact.avatar).toMatchObject({ width: 156, height: 156, borderWidth: 0 });
    expect(normal.heading.fontSize).toBe(20);
    expect(compact.bio.fontSize).toBe(15.6);
    expect(normal.link).toEqual({ borderRadius: 0 });
    expect(normal.content.width).toBe('min(100% - 40px, 720px)');
    expect(normal.surface.paddingTop).toBeUndefined();
    expect(appearance.avatarSize).toBe(9000);
  });

  it('uses the active theme as the first gradient color and bounds its angle', () => {
    const styles = profileAppearanceStyles({
      ...testProfile,
      theme: 'ink',
      appearance: { backgroundGradientColor: '#ffdd88', backgroundGradientAngle: 900 },
    });
    expect(styles.page.backgroundImage).toBe('linear-gradient(360deg, #282e2c, #ffdd88)');
  });

  it('keeps outline buttons transparent and gives glass buttons a tinted background', () => {
    const profile = {
      ...testProfile,
      appearance: {
        linkStyle: 'outline',
        linkBackgroundColor: '#aabbcc',
        linkTextColor: '#112233',
      } satisfies ProfileAppearance,
    };
    expect(profileAppearanceStyles(profile).link).toMatchObject({
      backgroundColor: 'transparent',
      borderColor: 'currentColor',
      color: '#112233',
    });
    expect(
      profileAppearanceStyles({
        ...profile,
        appearance: { ...profile.appearance, linkStyle: 'glass' },
      }).link,
    ).toMatchObject({
      backgroundColor: 'color-mix(in srgb, #aabbcc 28%, transparent)',
      backdropFilter: 'blur(12px)',
    });
  });

  it('renders custom colors and sizes directly on elements and retains accessible link names', () => {
    const html = renderToStaticMarkup(
      createElement(ProfileCard, {
        profile: {
          ...testProfile,
          bio: 'My description',
          appearance: {
            textColor: '#123456',
            headingColor: '#654321',
            linkTextColor: '#abcdef',
            avatarSize: 160,
            avatarShape: 'square',
            fontFamily: 'mono',
            headingSize: 40,
          },
        },
        compact: true,
      }),
    );
    expect(html).toContain('--profile-text-color:#123456');
    expect(html).toContain('width:124.8px;height:124.8px');
    expect(html).toContain('border-radius:0');
    expect(html).toContain('color:#654321');
    expect(html).toContain('font-size:31.2px');
    expect(html).toContain('color:#abcdef');
    expect(html).toContain('aria-label="Portfolio (opens in a new tab)"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('hides optional avatar, branding, icons and arrows without hiding navigation', () => {
    const html = renderToStaticMarkup(
      createElement(ProfileCard, {
        profile: {
          ...testProfile,
          appearance: {
            showAvatar: false,
            showBranding: false,
            showLinkIcons: false,
            showLinkArrows: false,
          },
        },
      }),
    );
    expect(html).not.toContain('class="profile-avatar"');
    expect(html).not.toContain('class="profile-brand"');
    expect(html).not.toContain('platform-icon');
    expect(html).not.toContain('profile-link-arrow');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('Test Owner');
  });
});
