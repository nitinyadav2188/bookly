import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // Playwright and local previews often hit 127.0.0.1 while Next binds as localhost
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
