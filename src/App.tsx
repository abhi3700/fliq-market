import { useEffect, useMemo, useState } from "react";
import { products } from "./data/products";
import { PaymentMethod, type Product } from "./types";
import { formatUsd } from "./utils/money";
import { UniFiPayOption, UnifiWaitDialog } from "./lib/unifi/widget";
import { UnifiAsset, UnifiNetwork } from "./lib/unifi/types";
import {
    create_pay_receipt_url,
    checkPaymentStatus,
    create_unifi_session,
    load_unifi_runtime_config,
} from "./lib/unifi/utils";
import { TOT_EXPIRY_SECONDS } from "./lib/unifi/constants";

type Screen = "marketplace" | "payment";

function calcTax(subtotal: number): number {
    const TAX_RATE = 0.0825; // 8.25% demo
    return subtotal * TAX_RATE;
}

function FooterDivider() {
    return <span className="inline-block h-5 w-px rounded bg-black/25" />;
}

function SiteFooter() {
    return (
        <footer className="border-t border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-5 px-4 py-6">
                <a
                    href="https://www.unifiweb3.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#2563EB] sm:text-base text-sm hover:opacity-80"
                >
                    Website
                </a>

                <FooterDivider />

                <a
                    href="https://linkedin.com/company/unifi-web3"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#0A66C2] sm:text-base text-sm hover:opacity-80"
                >
                    LinkedIn
                </a>

                <FooterDivider />

                <a
                    href="https://x.com/UniFi495650"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-black sm:text-base text-sm hover:opacity-80"
                >
                    X
                </a>

                <FooterDivider />

                <a
                    href="https://t.me/unifi_channel"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#229ED9] sm:text-base text-sm hover:opacity-80"
                >
                    Telegram
                </a>
            </div>
        </footer>
    );
}

export default function App() {
    const [screen, setScreen] = useState<Screen>("marketplace");
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Product | null>(null);

    const [qty, setQty] = useState<number>(1);
    const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.Unifi);
    const [unifiAsset, setUnifiAsset] = useState<UnifiAsset>("USDT");
    const [unifiNetwork, setUnifiNetwork] = useState<UnifiNetwork>("Ethereum");
    const [isPaying, setIsPaying] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [receiptId, setReceiptId] = useState<string | null>(null);

    const [unifiDialogOpen, setUnifiDialogOpen] = useState(false);
    const [unifiSecondsLeft, setUnifiSecondsLeft] =
        useState<number>(TOT_EXPIRY_SECONDS);
    const [unifiSessionId, setUnifiSessionId] = useState<string | null>(null);
    const [unifiStatusText, setUnifiStatusText] = useState<string>(
        "Waiting for payment…",
    );
    const [unifiPayUrl, setUnifiPayUrl] = useState<string | null>(null);

    useEffect(() => {
        void load_unifi_runtime_config();
    }, []);

    async function onUnifiCheckStatus() {
        if (!unifiSessionId) return;

        setUnifiStatusText("Checking status…");
        // In production we call via same-origin /api proxy (Cloudflare Function injects the key).
        // In dev, you can optionally call direct with a key, but default is still /api.
        const r = await checkPaymentStatus(unifiSessionId, {
            apiBaseUrl: "/api",
            apiKey: import.meta.env.DEV
                ? (import.meta.env.VITE_UNIFI_API_KEY as string | undefined)
                : undefined,
        });

        if (import.meta.env.DEV && !import.meta.env.VITE_UNIFI_API_KEY) {
            // Not fatal if you're using the /api proxy in dev too, but helpful for direct mode.
            // You can ignore this message if /api is working.
            // (Keeping it as status text only when we're failing.)
        }

        if (r.state === "paid") {
            setReceiptId(r.receiptId);
            setUnifiStatusText("Payment confirmed ✅");
            setUnifiDialogOpen(false);
            setIsPaying(false);
            setIsSuccess(true);
            return;
        }

        if (r.state === "failed") {
            setUnifiStatusText(
                r.message || "Payment failed. Please try again.",
            );
            return;
        }

        setUnifiStatusText("Still waiting for payment…");
    }

    function closeUnifiDialog() {
        setReceiptId(null);
        setUnifiPayUrl(null);
        setUnifiDialogOpen(false);
        setIsPaying(false);
        setUnifiStatusText("Waiting for payment…");
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return products;
        return products.filter(
            (p) =>
                p.title.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q),
        );
    }, [query]);

    const pricing = useMemo(() => {
        if (!selected) return null;
        const subtotal = selected.priceUsd * qty;
        const tax = calcTax(subtotal);
        const total = subtotal + tax;
        return { subtotal, tax, total };
    }, [selected, qty]);

    function startCheckout(p: Product) {
        setSelected(p);
        setQty(1);
        setMethod(PaymentMethod.Unifi);
        setUnifiAsset("USDT");
        setUnifiNetwork("Ethereum");
        setIsPaying(false);
        setIsSuccess(false);
        setReceiptId(null);
        setUnifiDialogOpen(false);
        setUnifiSessionId(null);
        setUnifiPayUrl(null);
        setUnifiStatusText("Waiting for payment…");
        setScreen("payment");
    }

    function backToMarketplace() {
        setScreen("marketplace");
        // keep selection? usually no; but keeping it is also fine.
        // We'll keep selected so user can go back & checkout again quickly if desired.
    }

    // NOTE: Use a real deadline-based countdown so the timer matches wall-clock time
    // even if the tab is backgrounded or interval ticks are delayed.
    useEffect(() => {
        if (!unifiDialogOpen) return;

        const expiresAt = Date.now() + TOT_EXPIRY_SECONDS * 1000;

        const syncRemaining = () => {
            const remaining = Math.max(
                0,
                Math.ceil((expiresAt - Date.now()) / 1000),
            );

            setUnifiSecondsLeft(remaining);

            if (remaining === 0) {
                closeUnifiDialog();
                return true;
            }

            return false;
        };

        // Set immediately so the UI starts from the exact configured duration.
        if (syncRemaining()) return;

        const id = window.setInterval(() => {
            if (syncRemaining()) {
                window.clearInterval(id);
            }
        }, 250);

        return () => window.clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unifiDialogOpen]);

    async function payNow() {
        if (!selected || !pricing) return;

        setIsPaying(true);

        if (method == PaymentMethod.Unifi) {
            // pricing.total is in USD; for the demo we use 2 decimals.
            // TODO: In production, format based on token decimals.
            const amountStr = pricing.total.toFixed(2); // "12.34"

            const { sessionId, payUrl } = await create_unifi_session({
                merchant_id: "demo_merchant",
                user_id: "demo_user",
                seed: "demo_seed",
                chain: unifiNetwork,
                coin: unifiAsset,
                to_address: "0x000000000000000000000000000000000000dEaD", // demo address
                amount: amountStr,
            });

            setUnifiSessionId(sessionId);
            setUnifiPayUrl(payUrl);
            window.open(payUrl, "_blank", "noopener,noreferrer");

            // 2) Show a dialog waiting for payment (auto closes after 20 mins)
            setUnifiStatusText("Waiting for payment…");
            setUnifiDialogOpen(true);
            return; // Don't mark success yet; we do it after status becomes "paid"
        } else {
            // fake payment
            await new Promise((r) => setTimeout(r, 900));
        }
        // At this point, we are in the non-UniFi path (the UniFi branch returns early).
        setIsPaying(false);
        setIsSuccess(true);
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-extrabold text-white">
                            M
                        </div>
                        <div>
                            <div className="text-base font-extrabold tracking-tight">
                                {screen === "marketplace"
                                    ? "FliQMarket"
                                    : "Checkout"}
                            </div>
                            <div className="sm:text-sm text-[10px] text-slate-500">
                                {screen === "marketplace"
                                    ? "Lean marketplace demo"
                                    : "Pay securely (demo)"}
                            </div>
                        </div>
                    </div>

                    {screen === "marketplace" ? (
                        <input
                            className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search products…"
                            aria-label="Search products"
                        />
                    ) : (
                        <button
                            className="rounded-xl border border-slate-200 bg-white sm:px-4 px-3 py-2 sm:text-sm text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.99] cursor-pointer"
                            onClick={backToMarketplace}
                        >
                            ← Continue shopping
                        </button>
                    )}
                </div>
            </header>

            <main className="mx-auto w-full max-w-6xl px-4 py-6">
                {screen === "marketplace" ? (
                    <MarketplaceView
                        products={filtered}
                        onBuy={startCheckout}
                    />
                ) : (
                    <PaymentView
                        selected={selected}
                        qty={qty}
                        setQty={setQty}
                        method={method}
                        setMethod={setMethod}
                        unifiAsset={unifiAsset}
                        setUnifiAsset={setUnifiAsset}
                        unifiNetwork={unifiNetwork}
                        setUnifiNetwork={setUnifiNetwork}
                        pricing={pricing}
                        isPaying={isPaying}
                        isSuccess={isSuccess}
                        receiptId={receiptId}
                        onPay={payNow}
                        onBack={backToMarketplace}
                    />
                )}
            </main>

            <UnifiWaitDialog
                open={unifiDialogOpen}
                secondsLeft={unifiSecondsLeft}
                statusText={unifiStatusText}
                payUrl={unifiPayUrl}
                onCheckStatus={onUnifiCheckStatus}
                onClose={closeUnifiDialog}
            />

            <SiteFooter />
        </div>
    );
}

function MarketplaceView({
    products,
    onBuy,
}: {
    products: Product[];
    onBuy: (p: Product) => void;
}) {
    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
                <div
                    key={p.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                    <img
                        className="h-44 w-full object-cover"
                        src={p.imageUrl}
                        alt={p.title}
                    />
                    <div className="space-y-3 p-4">
                        <div className="text-base font-extrabold text-slate-900">
                            {p.title}
                        </div>
                        <div className="text-sm text-slate-600">
                            {p.description}
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="text-lg font-extrabold">
                                {formatUsd(p.priceUsd)}
                            </div>
                            <button
                                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 active:scale-[0.99] cursor-pointer"
                                onClick={() => onBuy(p)}
                            >
                                Buy
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function PaymentView({
    selected,
    qty,
    setQty,
    method,
    setMethod,
    unifiAsset,
    setUnifiAsset,
    unifiNetwork,
    setUnifiNetwork,
    pricing,
    isPaying,
    isSuccess,
    receiptId,
    onPay,
    onBack,
}: {
    selected: Product | null;
    qty: number;
    setQty: (n: number) => void;
    method: PaymentMethod;
    setMethod: (m: PaymentMethod) => void;
    unifiAsset: UnifiAsset;
    setUnifiAsset: (a: UnifiAsset) => void;
    unifiNetwork: UnifiNetwork;
    setUnifiNetwork: (n: UnifiNetwork) => void;
    pricing: { subtotal: number; tax: number; total: number } | null;
    isPaying: boolean;
    isSuccess: boolean;
    receiptId: string | null;
    onPay: () => void;
    onBack: () => void;
}) {
    if (!selected || !pricing) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-extrabold tracking-wide text-slate-900">
                    No product selected
                </div>
                <div className="mt-2 text-sm text-slate-600">
                    Go back to the marketplace and choose a product.
                </div>
                <div className="mt-4">
                    <button
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 active:scale-[0.99]"
                        onClick={onBack}
                    >
                        ← Back to Marketplace
                    </button>
                </div>
            </div>
        );
    }

    const disableEdits = isPaying || isSuccess;
    const receiptUrl = receiptId ? create_pay_receipt_url(receiptId) : null;

    return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-extrabold tracking-wide text-slate-900">
                    Payment method
                </div>

                <div className="mt-4 space-y-3">
                    <label
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 shadow-sm transition ${
                            method === PaymentMethod.Debit
                                ? "border-blue-500 ring-4 ring-blue-50"
                                : "border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                        <input
                            type="radio"
                            name="payment"
                            checked={method === PaymentMethod.Debit}
                            onChange={() => setMethod(PaymentMethod.Debit)}
                            disabled={disableEdits}
                        />
                        <div className="flex flex-col gap-1">
                            <div className="text-sm font-extrabold text-slate-900">
                                Debit Card
                            </div>
                            <div className="text-xs text-slate-500">
                                Pay using debit card
                            </div>
                        </div>
                    </label>

                    <label
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 shadow-sm transition ${
                            method === PaymentMethod.Credit
                                ? "border-blue-500 ring-4 ring-blue-50"
                                : "border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                        <input
                            type="radio"
                            name="payment"
                            checked={method === PaymentMethod.Credit}
                            onChange={() => setMethod(PaymentMethod.Credit)}
                            disabled={disableEdits}
                        />
                        <div className="flex flex-col gap-1">
                            <div className="text-sm font-extrabold text-slate-900">
                                Credit Card
                            </div>
                            <div className="text-xs text-slate-500">
                                Pay using credit card
                            </div>
                        </div>
                    </label>

                    <label
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 shadow-sm transition ${
                            method === PaymentMethod.Upi
                                ? "border-blue-500 ring-4 ring-blue-50"
                                : "border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                        <input
                            type="radio"
                            name="payment"
                            checked={method === PaymentMethod.Upi}
                            onChange={() => setMethod(PaymentMethod.Upi)}
                            disabled={disableEdits}
                        />
                        <div className="flex flex-col gap-1">
                            <div className="text-sm font-extrabold text-slate-900">
                                UPI
                            </div>
                            <div className="text-xs text-slate-500">
                                Pay using UPI (demo)
                            </div>
                        </div>
                    </label>

                    <UniFiPayOption
                        method={method}
                        setMethod={setMethod}
                        disableEdits={disableEdits}
                        asset={unifiAsset}
                        setAsset={setUnifiAsset}
                        network={unifiNetwork}
                        setNetwork={setUnifiNetwork}
                    />
                </div>

                {!isSuccess ? (
                    <button
                        className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99] cursor-pointer"
                        onClick={onPay}
                        disabled={isPaying}
                    >
                        {isPaying
                            ? "Processing…"
                            : `Pay ${formatUsd(pricing.total)}`}
                    </button>
                ) : (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-extrabold text-white">
                            ✓ Payment successful
                        </div>
                        <div className="mt-2 text-base font-extrabold text-slate-900">
                            Your product is on the way.
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                            Order confirmed for <b>{selected.title}</b>.
                        </div>
                        {receiptUrl ? (
                            <div className="mt-3">
                                <a
                                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 active:scale-[0.99]"
                                    href={receiptUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    View receipt
                                </a>
                            </div>
                        ) : null}

                        <div className="mt-3">
                            <button
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99] cursor-pointer"
                                onClick={onBack}
                            >
                                ← Back to Marketplace
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-extrabold tracking-wide text-slate-900">
                    Order summary
                </div>

                <div className="mt-4 flex items-center gap-4">
                    <img
                        className="h-16 w-16 rounded-xl object-cover"
                        src={selected.imageUrl}
                        alt={selected.title}
                    />
                    <div>
                        <div className="text-sm font-extrabold text-slate-900">
                            {selected.title}
                        </div>
                        <div className="text-xs text-slate-500">
                            {formatUsd(selected.priceUsd)} each
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-500">
                        Quantity
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-base font-extrabold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                            onClick={() => setQty(Math.max(1, qty - 1))}
                            disabled={disableEdits}
                        >
                            −
                        </button>
                        <div className="min-w-10 text-center text-sm font-extrabold">
                            {qty}
                        </div>
                        <button
                            className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-base font-extrabold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                            onClick={() => setQty(qty + 1)}
                            disabled={disableEdits}
                        >
                            +
                        </button>
                    </div>
                </div>

                <div className="mt-5 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-sm">
                        <div className="text-slate-600">Actual price</div>
                        <div className="font-semibold">
                            {formatUsd(selected.priceUsd)}
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <div className="text-slate-600">Qty</div>
                        <div className="font-semibold">{qty}</div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <div className="text-slate-600">Subtotal</div>
                        <div className="font-semibold">
                            {formatUsd(pricing.subtotal)}
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <div className="text-slate-600">Tax</div>
                        <div className="font-semibold">
                            {formatUsd(pricing.tax)}
                        </div>
                    </div>
                    <div className="my-2 h-px w-full bg-slate-200" />
                    <div className="flex items-center justify-between text-sm font-extrabold">
                        <div>Total</div>
                        <div>{formatUsd(pricing.total)}</div>
                    </div>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                    Note: Demo flow only (no real gateway).
                </div>
            </div>
        </div>
    );
}
