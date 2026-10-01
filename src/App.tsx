import { useEffect, useMemo, useState } from "react";
import { products } from "./data/products";
import { PaymentMethod, type Product } from "./types";
import { formatUsd } from "./utils/money";
import {
    UniFiPayOption,
    UnifiWaitDialog,
    ViewReceipt,
} from "./lib/unifi/widget";
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
    return (
        <span className="inline-block h-4 w-px rounded bg-black/25 sm:h-5" />
    );
}

function SiteFooter() {
    return (
        <footer className="border-t border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-3 py-4 sm:gap-5 sm:px-4 sm:py-6">
                <a
                    href="https://payunifi.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[#2563EB] hover:opacity-80 sm:text-base"
                >
                    Website
                </a>

                <FooterDivider />

                <a
                    href="https://linkedin.com/company/unifi-web3"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[#0A66C2] hover:opacity-80 sm:text-base"
                >
                    LinkedIn
                </a>

                <FooterDivider />

                <a
                    href="https://x.com/UniFi495650"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-black hover:opacity-80 sm:text-base"
                >
                    X
                </a>

                <FooterDivider />

                <a
                    href="https://t.me/unifi_channel"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[#229ED9] hover:opacity-80 sm:text-base"
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
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-extrabold text-white sm:h-10 sm:w-10 sm:rounded-xl sm:text-sm">
                            M
                        </div>
                        <div>
                            <div className="text-sm font-extrabold tracking-tight sm:text-base">
                                {screen === "marketplace"
                                    ? "FliQMarket"
                                    : "Checkout"}
                            </div>
                            <div className="text-[9px] text-slate-500 sm:text-sm">
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
                            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.99] sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm"
                            onClick={backToMarketplace}
                        >
                            ← Continue shopping
                        </button>
                    )}
                </div>
            </header>

            <main className="mx-auto w-full max-w-6xl px-2.5 py-3 sm:px-4 sm:py-6">
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
        <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
                <div className="text-[13px] font-extrabold tracking-wide text-slate-900 sm:text-sm">
                    Payment method
                </div>

                <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                    <label
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 shadow-sm transition sm:gap-3 sm:rounded-2xl sm:p-4 ${
                            method === PaymentMethod.Debit
                                ? "border-blue-500 ring-2 ring-blue-50 sm:ring-4"
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
                        <div className="flex flex-col gap-0.5 sm:gap-1">
                            <div className="text-[13px] font-extrabold text-slate-900 sm:text-sm">
                                Debit Card
                            </div>
                            <div className="text-[11px] text-slate-500 sm:text-xs">
                                Pay using debit card
                            </div>
                        </div>
                    </label>

                    <label
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 shadow-sm transition sm:gap-3 sm:rounded-2xl sm:p-4 ${
                            method === PaymentMethod.Credit
                                ? "border-blue-500 ring-2 ring-blue-50 sm:ring-4"
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
                        <div className="flex flex-col gap-0.5 sm:gap-1">
                            <div className="text-[13px] font-extrabold text-slate-900 sm:text-sm">
                                Credit Card
                            </div>
                            <div className="text-[11px] text-slate-500 sm:text-xs">
                                Pay using credit card
                            </div>
                        </div>
                    </label>

                    <label
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 shadow-sm transition sm:gap-3 sm:rounded-2xl sm:p-4 ${
                            method === PaymentMethod.Upi
                                ? "border-blue-500 ring-2 ring-blue-50 sm:ring-4"
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
                        <div className="flex flex-col gap-0.5 sm:gap-1">
                            <div className="text-[13px] font-extrabold text-slate-900 sm:text-sm">
                                UPI
                            </div>
                            <div className="text-[11px] text-slate-500 sm:text-xs">
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
                        className="mt-3 w-full cursor-pointer rounded-xl bg-slate-900 px-3 py-2.5 text-[13px] font-extrabold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99] sm:mt-4 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
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
                            <ViewReceipt receiptUrl={receiptUrl} />
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

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
                <div className="text-[13px] font-extrabold tracking-wide text-slate-900 sm:text-sm">
                    Order summary
                </div>
                <div className="mt-3 flex items-center gap-3 sm:mt-4 sm:gap-4">
                    <img
                        className="h-14 w-14 rounded-lg object-cover sm:h-16 sm:w-16 sm:rounded-xl"
                        src={selected.imageUrl}
                        alt={selected.title}
                    />
                    <div>
                        <div className="text-[13px] font-extrabold text-slate-900 sm:text-sm">
                            {selected.title}
                        </div>
                        <div className="text-[11px] text-slate-500 sm:text-xs">
                            {formatUsd(selected.priceUsd)} each
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex items-center justify-between sm:mt-5">
                    <div className="text-[11px] font-semibold text-slate-500 sm:text-xs">
                        Quantity
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-sm font-extrabold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60 sm:h-9 sm:w-9 sm:rounded-xl sm:text-base"
                            onClick={() => setQty(Math.max(1, qty - 1))}
                            disabled={disableEdits}
                        >
                            −
                        </button>
                        <div className="min-w-8 text-center text-[13px] font-extrabold sm:min-w-10 sm:text-sm">
                            {qty}
                        </div>
                        <button
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-sm font-extrabold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60 sm:h-9 sm:w-9 sm:rounded-xl sm:text-base"
                            onClick={() => setQty(qty + 1)}
                            disabled={disableEdits}
                        >
                            +
                        </button>
                    </div>
                </div>
                <div className="mt-4 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:mt-5 sm:space-y-2 sm:rounded-2xl sm:p-4">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="text-slate-600">Actual price</div>
                        <div className="font-semibold">
                            {formatUsd(selected.priceUsd)}
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="text-slate-600">Qty</div>
                        <div className="font-semibold">{qty}</div>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="text-slate-600">Subtotal</div>
                        <div className="font-semibold">
                            {formatUsd(pricing.subtotal)}
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="text-slate-600">Tax</div>
                        <div className="font-semibold">
                            {formatUsd(pricing.tax)}
                        </div>
                    </div>
                    <div className="my-1.5 h-px w-full bg-slate-200 sm:my-2" />
                    <div className="flex items-center justify-between text-xs font-extrabold sm:text-sm">
                        <div>Total</div>
                        <div>{formatUsd(pricing.total)}</div>
                    </div>
                </div>
                <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-[11px] text-blue-800 sm:mt-4 sm:gap-2 sm:rounded-xl sm:px-3 sm:text-xs">
                    <i
                        className="bi bi-info-circle-fill mt-0.5 flex-none text-sm text-blue-700"
                        aria-hidden="true"
                    ></i>
                    <span className="min-w-0">
                        <b className="block">UniFi payments are live.</b>
                        <span className="mt-0.5 block">
                            Debit card, credit card and UPI are demo-only in this
                            marketplace.
                        </span>
                    </span>
                </div>{" "}
            </div>
        </div>
    );
}
