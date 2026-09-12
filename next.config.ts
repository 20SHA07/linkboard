import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  // Docker runs the standalone server; ordinary Node installs use `next start`.
  output: process.env.LINKBOARD_STANDALONE === '1' ? 'standalone' : undefined,
  // Runtime databases and local artifacts must never enter deployment bundles.
  outputFileTracingExcludes: {
    '/*': ['./data/**/*', './artifacts/**/*', './.npm-cache/**/*', './**/*.sqlite*', './**/*.db*'],
  },
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default nextConfig;
