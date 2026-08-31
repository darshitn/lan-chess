import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Also try repo root .env (one level up)
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        "/api": {
          target: env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
    },
    envPrefix: "VITE_",
    define: {
      // fallback if VITE_API_BASE_URL not set
      __VITE_API_BASE__: JSON.stringify(env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"),
    },
  };
});
