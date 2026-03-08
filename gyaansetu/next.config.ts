import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Proxy /api/* → backend devtunnel so browser-side calls don't hit CORS issues
        source: '/backend/:path*',
        destination: 'https://dwain-unmystic-addyson.ngrok-free.dev/:path*',
      },
    ]
  },
};

export default nextConfig;
