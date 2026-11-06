import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@tillpro/shared": resolve("../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5175,
    strictPort: true,
  },
});
