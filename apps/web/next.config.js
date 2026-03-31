// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Proxy /api calls to the BFF — works in both dev and prod (via proxy label)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_INTERNAL_URL ?? 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
