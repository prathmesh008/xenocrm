import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    // Configure log level: 0=NONE, 1=ERROR, 2=WARN, 3=INFO, 4=DEBUG
    LOG_LEVEL: process.env.LOG_LEVEL || '2', // Default to WARN level for concise output
    // API key for delivery receipt endpoints (dev only)
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