/** @type {import('next').NextConfig} */

function getRemotePatterns() {
  const patterns = [
    {
      protocol: "https",
      hostname: "*.supabase.co",
      pathname: "/storage/v1/object/public/**",
    },
    {
      protocol: "https",
      hostname: "*.workers.dev",
      pathname: "/**",
    },
  ];

  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL?.trim();
  if (cdnUrl) {
    try {
      const parsed = new URL(cdnUrl);
      patterns.push({
        protocol: parsed.protocol.replace(":", ""),
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        pathname: "/**",
      });
    } catch {
      // Ignore invalid URL format
    }
  }

  return patterns;
}

const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: getRemotePatterns(),
  },
  async headers() {
    return [
      {
        // 3D models: meshopt-compressed GLB files are immutable with ?v=N versioning
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      {
        // Static images in public/images
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // Next.js hashed static bundles
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
