import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Cross-origin isolation (COOP + COEP) enables SharedArrayBuffer, which the
 * faster multi-threaded ffmpeg core needs. It's applied to the dev server AND
 * `vite preview`. The single-thread core works without these headers, so the app
 * still runs on hosts that can't set them — the client just falls back.
 *
 * For production, replicate these headers on your host (see public/_headers for
 * Netlify/Cloudflare and vercel.json for Vercel).
 */
const crossOriginIsolation = () => {
  const setHeaders = (_req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
  };
  return {
    name: "cross-origin-isolation",
    configureServer(server) {
      server.middlewares.use(setHeaders);
    },
    configurePreviewServer(server) {
      server.middlewares.use(setHeaders);
    },
  };
};

export default defineConfig({
  plugins: [react(), tailwindcss(), crossOriginIsolation()],

  // ffmpeg.wasm resolves its worker + core URLs via import.meta.url. Vite's
  // esbuild pre-bundling can mangle that resolution, so serve these as native ESM.
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },

  // First-party workers should be ES modules (matches ffmpeg's { type: 'module' }).
  worker: {
    format: "es",
  },

  build: {
    // The core relies on modern wasm / top-level await.
    target: "esnext",
  },
});
