/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@repo/ui', '@repo/shared-types', '@repo/db', '@repo/marketplace-adapters'],
  experimental: {
    optimizePackageImports: ['@repo/ui', 'lucide-react'],
  },
  images: {
    domains: ['http2.mlstatic.com', 'cdn.fravega.com', 'cdn.garbarino.com', 'cdn.megatone.net'],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;