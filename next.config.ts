import type { NextConfig } from 'next';

const staticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || '';
if (basePath && !/^\/(?:[a-zA-Z0-9_-]+\/?)*[a-zA-Z0-9_-]$/.test(basePath))
  throw new Error(
    'NEXT_PUBLIC_BASE_PATH must be a path such as /linkboard, without a trailing slash.',
  );

const nextConfig: NextConfig = {
  // Docker runs the standalone server; ordinary Node installs use `next start`.
  output: staticExport
    ? 'export'
    : process.env.LINKBOARD_STANDALONE === '1'
      ? 'standalone'
      : undefined,
  basePath,
  ...(staticExport ? { trailingSlash: true } : {}),
  // The isolated Pages build reuses node_modules from the original workspace.
  ...(process.env.LINKBOARD_BUILD_ROOT
    ? { turbopack: { root: process.env.LINKBOARD_BUILD_ROOT } }
    : {}),
  // Runtime databases and local artifacts must never enter deployment bundles.
  outputFileTracingExcludes: {
    '/*': ['./data/**/*', './artifacts/**/*', './.npm-cache/**/*', './**/*.sqlite*', './**/*.db*'],
  },
  poweredByHeader: false,
  devIndicators: false,
  ...(!staticExport
    ? {
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
      }
    : {}),
};
export default nextConfig;
