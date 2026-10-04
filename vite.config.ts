import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { parsePaymentStatusPollIntervalSeconds } from "./runtime-config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = env.UNIFI_API_BASE_URL?.trim() || "http://0.0.0.0:3333";
  const apiKey = env.UNIFI_API_KEY?.trim();
  const merchantWalletAddress = env.MERCHANT_WALLET_ADDRESS?.trim();
  const webAppBaseUrl = env.UNIFI_WEB_APP_BASE_URL?.trim();
  const paymentStatusPollInterval = parsePaymentStatusPollIntervalSeconds(
    env.PAYMENT_STATUS_POLL_INTERVAL,
  );

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "unifi-local-runtime-config",
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            const url = new URL(request.url ?? "/", "http://localhost");
            if (request.method !== "GET" || url.pathname !== "/api/config") {
              next();
              return;
            }

            if (!merchantWalletAddress) {
              response.statusCode = 500;
              response.setHeader("Content-Type", "application/json; charset=utf-8");
              response.setHeader("Cache-Control", "no-store");
              response.end(
                JSON.stringify({
                  error: "Server configuration is missing MERCHANT_WALLET_ADDRESS.",
                }),
              );
              return;
            }

            response.statusCode = 200;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.setHeader("Cache-Control", "no-store");
            response.end(
              JSON.stringify({
                MERCHANT_WALLET_ADDRESS: merchantWalletAddress,
                UNIFI_WEB_APP_BASE_URL: webAppBaseUrl || undefined,
                PAYMENT_STATUS_POLL_INTERVAL: paymentStatusPollInterval,
              }),
            );
          });
        },
      },
    ],

    // Always use the application's React instance for widget hooks.
    resolve: {
      dedupe: ["react", "react-dom"],
    },

    // Only VITE_* variables are exposed to browser code. The UniFi values
    // above are read by Vite's local server configuration, not bundled.
    envPrefix: ["VITE_"],

    // Local equivalent of the deployed Cloudflare Function. /api/config is
    // handled by the local runtime-config plugin before this proxy.
    server: {
      proxy: {
        "/api/unifi": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
          rewrite: (path) => path.replace(/^\/api\/unifi/, ""),
        },
      },
    },
  };
});
