/// <reference types='vitest' />

import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig((mode) => ({
  root: __dirname,
  server: {
    port: 3000,
    host: true,
    hmr: {
      protocol: "ws",
      host: "localhost",
      clientPort: 3000,
    },
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
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwindcss({
      optimize: true,
    }),
    tsconfigPaths(),
    mode.command === "serve" &&
      checker({
        typescript: {
          tsconfigPath: "./tsconfig.app.json",
        },
      }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../dist/web",
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
