import type { Metadata, Viewport } from 'next';
import MotionProvider from '@/components/motion/provider';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './globals.css';
import './public.css';
export const metadata: Metadata = {
  title: {
    default: 'Linkboard — A little space for everything you do',
    template: '%s · Linkboard',
  },
  description:
    'Your links, your style, your little corner of the internet. A free, self-hosted home for everything you create.',
  applicationName: 'Linkboard',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f8f9f6' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
