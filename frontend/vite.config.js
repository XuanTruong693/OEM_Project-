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
    allowedHosts: ["localhost", "127.0.0.1"],
    proxy: {
      "/socket.io": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/role": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
      "/auth": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
      "/exam_rooms": {
        target: "http://localhost:5000",
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
  optimizeDeps: {
    include: ["axios", "react", "react-dom", "react-router-dom"],
  },
});
