import type { NextConfig } from 'next';

/**
 * Same-origin API topology (plan: locked cookie decision; spec §12.3).
 *
 * In deployment the browser only ever talks to the Vercel origin: the client calls
 * the relative `/api/v1/...`, and this rewrite forwards to the Railway service.
 * The session cookie is therefore host-only on the Vercel domain
 * (`Secure; SameSite=Lax`, no `Domain`) — no third-party cookie, no credentialed
 * CORS in production.
 *
 * Locally there is no proxy: the client calls http://localhost:4000/api/v1 directly
 * and the API's CORS allowlist covers http://localhost:3000.
 */
const apiProxyTarget = process.env.API_PROXY_TARGET;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@weekflow/shared'],
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiProxyTarget.replace(/\/$/, '')}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
