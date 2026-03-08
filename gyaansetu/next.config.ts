import type { NextConfig } from "next";

// Use 127.0.0.1 instead of localhost to avoid IPv6 resolution delay on macOS/Node.js 17+.
// Override via env vars for non-local deployments.
const backendUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:8000'
const extractorUrl = process.env.EXTRACTOR_BASE_URL ?? 'http://127.0.0.1:8001'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: `${backendUrl}/:path*`,
      },
      {
        source: '/extractor/:path*',
        destination: `${extractorUrl}/:path*`,
      },
    ]
  },
};

export default nextConfig;
