import { createCloudflarePagesFunction } from "../vendor/unifi-pay-widget-server.js";

type Env = {
  UNIFI_API_KEY: string;
  MERCHANT_WALLET_ADDRESS: string;
  UNIFI_API_BASE_URL?: string;
  UNIFI_WEB_APP_BASE_URL?: string;
};

type PagesContext = {
  request: Request;
  env: Env;
};

const handleUniFiProxy = createCloudflarePagesFunction<Env>({
  apiPrefix: "/api/unifi",
});

export function onRequest(context: PagesContext): Promise<Response> | Response {
  const url = new URL(context.request.url);

  if (url.pathname === "/api/config") {
    if (context.request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed." }), {
        status: 405,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          Allow: "GET",
        },
      });
    }

    const merchantWalletAddress = context.env.MERCHANT_WALLET_ADDRESS?.trim();
    if (!merchantWalletAddress) {
      return new Response(
        JSON.stringify({
          error: "Server configuration is missing MERCHANT_WALLET_ADDRESS.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const webAppBaseUrl = context.env.UNIFI_WEB_APP_BASE_URL?.trim();
    return new Response(
      JSON.stringify({
        MERCHANT_WALLET_ADDRESS: merchantWalletAddress,
        UNIFI_WEB_APP_BASE_URL: webAppBaseUrl || undefined,
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return handleUniFiProxy(context);
}
