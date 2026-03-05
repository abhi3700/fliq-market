import type { UnifiAsset, UnifiNetwork } from "./types";
import { UNIFI_WEB_APP_BASE_URL_FALLBACK } from "./constants";

export type CreatePayUrlParams = {
    chain: UnifiNetwork;
    coin: UnifiAsset;
    to_address: string;
    // E.g. "100" or "100.2344".
    amount: string;
    session_id?: string;
};

let UNIFI_WEB_APP_BASE_URL_RUNTIME: string | null = null;

export function set_unifi_web_app_base_url(baseUrl: string) {
    UNIFI_WEB_APP_BASE_URL_RUNTIME = baseUrl;
}

export function get_unifi_web_app_base_url(): string {
    return (
        UNIFI_WEB_APP_BASE_URL_RUNTIME ||
        (import.meta.env.VITE_UNIFI_WEB_APP_BASE_URL as string | undefined) ||
        UNIFI_WEB_APP_BASE_URL_FALLBACK
    );
}

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
    return new URL(path, get_unifi_web_app_base_url()).toString();
}

export function create_pay_receipt_url(receipt_id: string): string {
    const parts = ["payment/receipt", encodeURIComponent(receipt_id)];

    const path = "/" + parts.join("/");
    return new URL(path, get_unifi_web_app_base_url()).toString();
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
): Promise<
    | { state: "pending" }
    | { state: "paid"; receiptId: string }
    | { state: "failed"; message: string }
> {
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
            // Backend might return plain text (e.g. "Invalid API Key...") or JSON.
            const contentType = res.headers.get("content-type") ?? "";
            let message = `Request failed (${res.status})`;

            try {
                if (contentType.includes("application/json")) {
                    const j: unknown = await res.json();

                    // Try to extract a useful message from common error shapes.
                    if (j && typeof j === "object") {
                        const obj = j as Record<string, unknown>;
                        const raw = obj.message ?? obj.error ?? obj.detail;
                        const s = typeof raw === "string" ? raw.trim() : "";
                        if (s) message = s;
                    }
                } else {
                    const t = (await res.text()).trim();
                    if (t) message = t;
                }
            } catch {
                // ignore parse errors
            }

            return { state: "failed", message };
        }

        const json = (await res.json()) as GetPaymentSessionStatusResponse;
        const receiptId = (json?.data ?? "").trim();

        // Per backend contract: empty string => still pending
        if (!receiptId) return { state: "pending" };

        return { state: "paid", receiptId };
    } catch (e) {
        const message =
            e instanceof Error
                ? e.message
                : "Network error while checking status";
        return { state: "failed", message };
    }
}

/**
 * Build a deterministic session id (sha256) and open the UniFi pay URL in a new tab
 *
 * @param args
 * @returns
 */
export async function create_unifi_session(args: {
    merchant_id: string;
    user_id: string;
    seed: string;
    chain: string;
    coin: string;
    to_address: string;
    amount: string;
}): Promise<{ sessionId: string; payUrl: string }> {
    const timestamp_us = Date.now() * 1000;

    // Keep payload stable; changes in JSON key order / values will change the hash.
    const payload = JSON.stringify({
        chain: args.chain,
        coin: args.coin,
        to_address: args.to_address,
        amount: args.amount,
    });

    const sessionId = await generateSessionId({
        merchant_id: args.merchant_id,
        user_id: args.user_id,
        payload,
        seed: args.seed,
        timestamp_us,
    });

    const payUrl = create_pay_url({
        chain: args.chain,
        coin: args.coin,
        to_address: args.to_address,
        amount: args.amount,
        session_id: sessionId,
    });

    return { sessionId, payUrl };
}

/**
 * Fetch runtime config from Cloudflare Pages Function
 * @returns None
 */
export async function load_unifi_runtime_config(): Promise<void> {
    try {
        const r = await fetch("/api/config", {
            method: "GET",
            headers: { Accept: "application/json" },
        });

        if (!r.ok) return;

        const j = (await r.json()) as {
            UNIFI_WEB_APP_BASE_URL?: string;
        };

        if (j?.UNIFI_WEB_APP_BASE_URL) {
            set_unifi_web_app_base_url(j.UNIFI_WEB_APP_BASE_URL);
        }
    } catch {
        // fallback will be used automatically
    }
}
