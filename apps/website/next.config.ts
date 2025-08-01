import { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: "../../dist/apps/website",
  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath: "./tsconfig.app.json",
  },
  transpilePackages: ["@snapflow/api-client"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "randomuser.me" },
    ],
  },
};

export default nextConfig;
