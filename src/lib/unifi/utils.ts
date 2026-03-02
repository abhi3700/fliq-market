import type { UnifiAsset, UnifiNetwork } from "./types";
import { UNIFI_WEB_APP_BASE_URL } from "./constants";

export type CreatePayUrlParams = {
  chain: UnifiNetwork;
  coin: UnifiAsset;
  to_address: string;
  // E.g. "100" or "100.2344".
  amount: string;
  session_id?: string;
};

export function create_pay_url(params: CreatePayUrlParams): string {
  const { chain, coin, to_address, amount, session_id } = params;

  const parts = [
    "fliqpay",
    encodeURIComponent(chain),
    encodeURIComponent(coin),
    encodeURIComponent(to_address),
    encodeURIComponent(String(amount)),
  ];

  if (session_id) {
    parts.push(encodeURIComponent(session_id));
  }

  const path = "/" + parts.join("/");
  return new URL(path, UNIFI_WEB_APP_BASE_URL).toString();
}

/**
 * Generate a deterministic session id (hex SHA-256) for a payment attempt.
 *
 * Formula:
 * `session_id = sha256(merchant_id, user_id, payload, seed, timestamp_us)`
 *
 * Example session_id: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
 *
 * Example:
 * ```ts
 * const timestamp_us = Date.now() * 1000;
 * const payload = JSON.stringify({
 *   chain: "Ethereum",
 *   coin: "USDT",
 *   to_address: "0xabc...",
 *   amount: "12.34",
 * });
 *
 * const session_id = await generateSessionId({
 *   merchant_id: "merchant_123",
 *   user_id: "user_456",
 *   payload,
 *   seed: "server_secret_or_nonce",
 *   timestamp_us,
 * });
 *
 * const payUrl = create_pay_url({
 *   chain: "Ethereum",
 *   coin: "USDT",
 *   to_address: "0xabc...",
 *   amount: "12.34",
 *   session_id,
 * });
 *
 * // http://0.0.0.0:3334/fliqpay/Ethereum/USDT/0xabc.../12.34/<session_id>
 * window.open(payUrl, "_blank", "noopener,noreferrer");
 * ```
 *
 * Notes:
 * - Keep `payload` canonical/stable; differing JSON key order changes the hash.
 * - `seed` should be unpredictable in production (e.g., backend secret or per-session nonce).
 */
export async function generateSessionId(input: {
  merchant_id: string;
  user_id: string;
  payload: string;
  seed: string;
  timestamp_us: number;
}): Promise<string> {
  const { merchant_id, user_id, payload, seed, timestamp_us } = input;

  const message = `${merchant_id}|${user_id}|${payload}|${seed}|${timestamp_us}`;

  const encoded = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

type GetPaymentSessionStatusResponse = {
  status?: string;
  data?: string; // empty string => still pending; non-empty => receipt_id
};

/**
 * Calls UniFi API server to fetch payment session status.
 *
 * Rust handler returns:
 * { status: "200 OK", data: "" | "<receipt_id>" }
 */
export async function checkPaymentStatus(
  sessionId: string,
  opts?: {
    apiBaseUrl?: string;
    apiKey?: string;
  },
): Promise<"pending" | "paid" | "failed"> {
  // Default to same-origin proxy (Cloudflare Pages Function in prod, Vite dev-proxy in dev).
  const apiBaseUrl = opts?.apiBaseUrl ?? "/api";

  const path = `/payment/merchant/session/${encodeURIComponent(sessionId)}`;

  const url = apiBaseUrl.startsWith("/")
    ? `${apiBaseUrl}${path}` // "/api" + "/payment/..."
    : new URL(path, apiBaseUrl).toString(); // absolute origin

  // If we're calling same-origin (relative /api), the proxy/function will inject the API key.
  const usesProxy = apiBaseUrl.startsWith("/");

  try {
    if (!usesProxy && !opts?.apiKey) {
      throw new Error("Missing UniFi API Key");
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    // Only attach Authorization when calling the UniFi API directly.
    if (!usesProxy && opts?.apiKey) {
      headers.Authorization = `Bearer ${opts.apiKey}`;
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      return "failed";
    }

    const json = (await res.json()) as GetPaymentSessionStatusResponse;
    const receiptId = (json?.data ?? "").trim();

    // Per backend contract: empty string => still pending
    if (!receiptId) return "pending";

    return "paid";
  } catch {
    return "failed";
  }
}
