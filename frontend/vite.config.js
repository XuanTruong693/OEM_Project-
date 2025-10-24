import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 4000,
    strictPort: true,
    cors: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "",
    ],
    proxy: {
      "/auth": {
        target: "http://localhost:5000 ",
        changeOrigin: true,
        secure: false,
      },
      "/exam_rooms": {
        target: "http://localhost:5000 ",
        changeOrigin: true,
        secure: false,
      },
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
