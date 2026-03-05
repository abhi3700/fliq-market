// Minimal Cloudflare Pages Function types (keeps this file self-contained)
// You can replace these with official types later if you install @cloudflare/workers-types.
type PagesFunction<EnvT = unknown> = (ctx: {
    request: Request;
    env: EnvT;
}) => Response | Promise<Response>;

type Env = {
    UNIFI_API_BASE_URL?: string;
    UNIFI_API_KEY?: string;
    UNIFI_WEB_APP_BASE_URL?: string;
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
    const { request, env } = ctx;

    // Allow preflight
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: corsHeaders(request),
        });
    }

    const UNIFI_WEB_APP_BASE_URL = env.UNIFI_WEB_APP_BASE_URL; // https://unifiweb3.example.com
    const UNIFI_API_BASE_URL = env.UNIFI_API_BASE_URL; // e.g. https://unifi-api.example.com
    const UNIFI_API_KEY = env.UNIFI_API_KEY; // secret

    if (!UNIFI_API_BASE_URL || !UNIFI_API_KEY || !UNIFI_WEB_APP_BASE_URL) {
        return new Response(
            "Missing UNIFI_API_BASE_URL/UNIFI_API_KEY/UNIFI_WEB_APP_BASE_URL",
            {
                status: 500,
            },
        );
    }

    // Public runtime config endpoint for the frontend
    // IMPORTANT: handle it here so it doesn't get proxied to the upstream API.
    const url = new URL(request.url);

    if (url.pathname === "/api/config") {
        return new Response(JSON.stringify({ UNIFI_WEB_APP_BASE_URL }), {
            status: 200,
            headers: {
                ...corsHeaders(request),
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
            },
        });
    }

    // Map: /api/<anything>  ->  <UNIFI_API_BASE_URL>/<anything>
    // const url = new URL(request.url);
    const upstreamPath = url.pathname.replace(/^\/api/, ""); // keep rest
    const upstreamUrl = new URL(upstreamPath + url.search, UNIFI_API_BASE_URL);

    // Copy request headers but DO NOT forward Host / CF headers, etc.
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${UNIFI_API_KEY}`);
    headers.delete("cookie"); // optional hardening
    headers.delete("host");

    const upstreamReq = new Request(upstreamUrl.toString(), {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method)
            ? undefined
            : request.body,
        redirect: "follow",
    });

    const resp = await fetch(upstreamReq);

    // Return upstream response + CORS headers (safe even if same-origin)
    const outHeaders = new Headers(resp.headers);
    for (const [k, v] of Object.entries(corsHeaders(request)))
        outHeaders.set(k, v);

    return new Response(resp.body, {
        status: resp.status,
        headers: outHeaders,
    });
};

function corsHeaders(request: Request) {
    const origin = request.headers.get("Origin") ?? "*";

    // TODO:
    // You can restrict this instead of "*" if you want:
    // const allowed = new Set(["https://yourdomain.com"]);
    // const allowOrigin = allowed.has(origin) ? origin : "null";

    return {
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
}
