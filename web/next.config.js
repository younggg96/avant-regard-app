/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Serve AVIF first (40-50% smaller than JPEG), fall back to WebP
    formats: ["image/avif", "image/webp"],

    // Cache optimized images for 24 h on the CDN/edge
    minimumCacheTTL: 86400,

    // Whitelist acceptable quality values; prevents arbitrary quality params
    // quality is specified per-<Image> component (75–90 range used in codebase)

    // Remote origins that may be optimized – ordered from most specific to
    // least specific; the wildcard fallback covers unknown CDN origins.
    remotePatterns: [
      { protocol: "https", hostname: "**.avantregard.com" },
      { protocol: "https", hostname: "api.avantregard.com" },
      // Supabase Storage (project-id varies per env)
      { protocol: "https", hostname: "**.supabase.co" },
      // AWS / CloudFront
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      // Alibaba Cloud / Tencent Cloud (CN object storage)
      { protocol: "https", hostname: "**.aliyuncs.com" },
      { protocol: "https", hostname: "**.myqcloud.com" },
      // Generic fallback for user-generated content from unknown origins
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

module.exports = nextConfig;
