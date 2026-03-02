import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // (Vite only exposes vars that start with one of these prefixes.)
  envPrefix: ["VITE_"],

  // Dev-only proxy to avoid CORS during local development.
  // Use it by calling the API from the frontend as `/api/...`.
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3333",
        // target: "https://unifi-api-jlq9.onrender.com",
        changeOrigin: true,
        secure: false,
        // Rewrite `/api/payment/..` -> `/payment/..`
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
