/// <reference types='vitest' />
import path from "path";
import { nxCopyAssetsPlugin } from "@nx/vite/plugins/nx-copy-assets.plugin";
import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";

export default defineConfig((mode) => ({
  root: __dirname,
  cacheDir: "../../node_modules/.vite/apps/website",
  server: {
    port: 3000,
    host: "localhost",
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    nxViteTsPaths(),
    nxCopyAssetsPlugin(["*.md"]),
    mode.command === "build" &&
      checker({
        typescript: {
          tsconfigPath: path.resolve(__dirname, "tsconfig.app.json"),
        },
      }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../../dist/apps/website",
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
