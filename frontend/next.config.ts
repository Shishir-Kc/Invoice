import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/invoices",
        destination: "/bills",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
