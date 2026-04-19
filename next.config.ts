import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    LOG_LEVEL: process.env.LOG_LEVEL || '2',
    API_KEY: process.env.API_KEY || 'development-api-key-xenocrm',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.pollinations.ai',
      },
    ],
  },
};

export default nextConfig;