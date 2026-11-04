import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep server actions/body limits sane for CSV previews.
  },
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
