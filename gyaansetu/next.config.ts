import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: 'http://localhost:8000/:path*',
      },
      {
        source: '/extractor/:path*',
        destination: 'http://localhost:8001/:path*',
      },
    ]
  },
};

export default nextConfig;
