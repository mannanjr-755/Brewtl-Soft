import type { NextConfig } from "next";
import path from "path";
import { existsSync } from "fs";

// In npm workspaces, `next` may be hoisted to the monorepo root.
const localNext = path.join(__dirname, "node_modules", "next");
const turbopackRoot = existsSync(localNext) ? __dirname : path.join(__dirname, "..");

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
