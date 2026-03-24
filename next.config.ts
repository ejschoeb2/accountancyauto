import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/help",
        destination: "/guides",
        permanent: true,
      },
      {
        source: "/tutorials",
        destination: "/guides",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
