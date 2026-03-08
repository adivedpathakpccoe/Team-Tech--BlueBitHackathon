import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Proxy /api/* → backend devtunnel so browser-side calls don't hit CORS issues
        source: '/backend/:path*',
        destination: 'https://rg89c906-8000.inc1.devtunnels.ms/:path*',
      },
    ]
  },
};

export default nextConfig;
