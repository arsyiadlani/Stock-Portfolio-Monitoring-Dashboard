import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5190,
    proxy: {
      "/api": {
        target: "http://localhost:8004",
        changeOrigin: true,
      },
    },
  },
});
