import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  devIndicators: false,
  experimental: {
    // Keep server actions/body limits sane for CSV previews.
  },
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
