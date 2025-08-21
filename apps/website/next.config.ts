import { NextConfig } from "next";
import { withContentlayer } from "next-contentlayer2";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath: "./tsconfig.app.json",
  },
  transpilePackages: ["@snapflow/api-client", "@snapflow/executor-api-client"],
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

export default withContentlayer(nextConfig);
