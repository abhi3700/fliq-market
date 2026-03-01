import type { UnifiAsset, UnifiNetwork } from "./types";

export const WEB_APP_BASE_URL = "http://0.0.0.0:3334";
// export const WEB_APP_BASE_URL = "https://unifiweb3.pages.dev";

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
  return new URL(path, WEB_APP_BASE_URL).toString();
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

export async function dummyCheckPaymentStatus(
  _sessionId: string,
  checkCountRef: { current: number },
): Promise<"pending" | "paid" | "failed"> {
  // Simulate an async API call
  await new Promise((r) => setTimeout(r, 500));

  checkCountRef.current += 1;

  // After 3 checks we treat it as paid (demo behavior)
  if (checkCountRef.current >= 3) return "paid";

  return "pending";
}
