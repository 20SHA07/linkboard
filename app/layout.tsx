import type { Metadata, Viewport } from 'next';
import MotionProvider from '@/components/motion/provider';
import ThemeProvider from '@/components/theme/provider';
import ThemeScript from '@/components/theme/script';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './globals.css';
import './public.css';
import './theme.css';
import './customization.css';
import './setup.css';
export const metadata: Metadata = {
  title: {
    default: 'Linkboard — A little space for everything you do',
    template: '%s · Linkboard',
  },
  description:
    'Your links, your style, your little corner of the internet. A free, self-hosted home for everything you create.',
  applicationName: 'Linkboard',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#171d19' },
  ],
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>
          <MotionProvider>{children}</MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
