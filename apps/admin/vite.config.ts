import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@tillpro/shared": resolve("../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
