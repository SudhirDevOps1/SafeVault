import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // @capacitor/app is a runtime-only module loaded on Android by Capacitor.
      // Marking it external prevents Rollup from failing during the web/desktop build.
      external: ['@capacitor/app'],
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react') || id.includes('lucide')) {
              return 'vendor-icons';
            }
            if (id.includes('hash-wasm') || id.includes('dexie')) {
              return 'vendor-crypto-db';
            }
            return 'vendor-core';
          }
        }
      }
    },
  },
});
