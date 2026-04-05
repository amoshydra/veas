import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const BUILD_PUBLIC_PATH = process.env.BUILD_PUBLIC_PATH || "/";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: BUILD_PUBLIC_PATH,
  define: {
    "import.meta.env.BASE_URL": JSON.stringify(BUILD_PUBLIC_PATH),
    "import.meta.env.VITE_DEMO_MODE": JSON.stringify(
      (process.env.VITE_DEMO_MODE === "true").toString(),
    ),
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
