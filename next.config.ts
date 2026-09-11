import type { NextConfig } from "next";

const staticExport = process.env.NEXT_OUTPUT_EXPORT === "1";

const nextConfig: NextConfig = {
  // Auth.js needs server routes. Capacitor/Android still uses a static export via
  // `npm run build:static` (NEXT_OUTPUT_EXPORT=1). Guest reading works in both modes.
  ...(staticExport
    ? {
        output: "export" as const,
        trailingSlash: true,
      }
    : {}),
  images: { unoptimized: true },
  // Playwright and local previews often hit 127.0.0.1 while Next binds as localhost
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
