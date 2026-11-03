import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:5237",
      "/health": "http://localhost:5237",
      "/hubs": {
        target: "http://localhost:5237",
        ws: true,
      },
    },
  },
});