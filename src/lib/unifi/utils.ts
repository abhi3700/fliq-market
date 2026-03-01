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

export function generateSessionId(): string {
  // Prefer crypto.randomUUID when available
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  // Fallback: reasonably unique for demo usage
  return `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
