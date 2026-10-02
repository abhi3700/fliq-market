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

const RECEIPT_STATUS_PREFIX = "/api/unifi/payment/onchain/receipt/";

function isUniFiReceiptId(value: string): boolean {
  return (
    value.length >= 26 &&
    value.length <= 128 &&
    value.includes("r") &&
    /^[0-9a-fA-Fr]+$/.test(value)
  );
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function handleReceiptStatusRequest(
  context: PagesContext,
  url: URL,
): Promise<Response> {
  if (context.request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const apiKey = context.env.UNIFI_API_KEY?.trim();
  if (!apiKey) {
    return jsonResponse(
      { error: "Server configuration is missing UNIFI_API_KEY." },
      500,
    );
  }

  let receiptId: string;
  try {
    receiptId = decodeURIComponent(
      url.pathname.slice(RECEIPT_STATUS_PREFIX.length),
    );
  } catch {
    return jsonResponse({ error: "Invalid receipt ID." }, 404);
  }

  if (receiptId.includes("/") || !isUniFiReceiptId(receiptId)) {
    return jsonResponse({ error: "Invalid receipt ID." }, 404);
  }

  const apiBaseUrl =
    context.env.UNIFI_API_BASE_URL?.trim() || "https://api.payunifi.com";
  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(
      `payment/onchain/receipt/${encodeURIComponent(receiptId)}`,
      apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`,
    );
  } catch {
    return jsonResponse(
      { error: "UNIFI_API_BASE_URL is not a valid absolute URL." },
      500,
    );
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      redirect: "follow",
    });
    const headers = new Headers(upstreamResponse.headers);
    headers.set("Cache-Control", "no-store");
    headers.delete("set-cookie");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers,
    });
  } catch {
    return jsonResponse({ error: "Unable to reach the UniFi API." }, 502);
  }
}

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

  if (url.pathname.startsWith(RECEIPT_STATUS_PREFIX)) {
    return handleReceiptStatusRequest(context, url);
  }

  return handleUniFiProxy(context);
}
