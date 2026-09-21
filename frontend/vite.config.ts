import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// In dev the API + WebSocket are proxied to the FastAPI backend so the app can
// always use same-origin relative URLs. That is what makes the exact same build
// work when it is served by the backend itself (packaged .exe) or wrapped in a
// native shell (APK) — there is no hard-coded host anywhere.
const BACKEND = process.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

const proxy = {
  "/api": { target: BACKEND, changeOrigin: true },
  "/ws": { target: BACKEND.replace(/^http/, "ws"), ws: true, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  // Relative base so the bundle works from file:// style native shells too.
  base: "./",
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    host: true,
    proxy,
  },
  preview: {
    port: 4173,
    host: true,
    proxy,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split the heavy animation/chart libs so first paint stays fast.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["gsap", "framer-motion"],
          charts: ["recharts"],
          query: ["@tanstack/react-query", "zod"],
        },
      },
    },
  },
});
