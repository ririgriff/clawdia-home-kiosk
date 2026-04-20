import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  // unsafe-eval: required by Next.js 16 / Turbopack in dev and by bundled deps in prod
  // unsafe-inline: required for Next.js hydration inline scripts
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // blob: for upload preview (URL.createObjectURL); https: for external recipe/dish images
  "img-src 'self' blob: data: https:",
  // next/font serves fonts from same origin at build time
  "font-src 'self'",
  // all API calls go to same-origin /api/* routes
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
