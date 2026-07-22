import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    port: 5173,
    // During `vite dev`, proxy API/WS calls to `wrangler dev` running on 8787.
    // Run `npm run dev:worker` in a second terminal alongside `npm run dev`.
    proxy: {
      "/ws": { target: "ws://127.0.0.1:8787", ws: true },
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true }
    }
  }
});
