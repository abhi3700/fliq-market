import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { products } from "./data/products";
import { PaymentMethod, type Product } from "./types";
import { formatUsd } from "./utils/money";
import {
    UniFiPaymentOption,
    UniFiPaymentStatusSheet,
    UniFiReceiptLink,
} from "unifi-pay-widget/react";
import {
    checkUniFiPaymentStatus,
    createUniFiPayment,
    type UniFiAsset,
    type UniFiNetwork,
} from "unifi-pay-widget";

type Screen = "marketplace" | "payment";

// FliqPay validates the timestamp embedded in the payment URL against this
// 15-minute lifetime. Keep the merchant countdown on that same deadline.
const UNIFI_PAYMENT_EXPIRY_SECONDS = 15 * 60;
const UNIFI_RECEIPT_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const UNIFI_RECEIPT_REFRESH_INTERVAL_SECONDS =
    UNIFI_RECEIPT_REFRESH_INTERVAL_MS / 1000;

type UniFiReceiptStatus =
    | "Processing"
    | "Failed"
    | "Confirmed"
    | "Finalized"
    | "Reorged";

const UNIFI_RECEIPT_STATUSES: readonly UniFiReceiptStatus[] = [
    "Processing",
    "Failed",
    "Confirmed",
    "Finalized",
    "Reorged",
];

function isUniFiReceiptStatus(value: unknown): value is UniFiReceiptStatus {
    return UNIFI_RECEIPT_STATUSES.includes(value as UniFiReceiptStatus);
}

function formatCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

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
    const searchInputRef = useRef<HTMLInputElement>(null);

    const [qty, setQty] = useState<number>(1);
    const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.Unifi);
    const [unifiAsset, setUnifiAsset] = useState<UniFiAsset>("USDT");
    const [unifiNetwork, setUnifiNetwork] = useState<UniFiNetwork>("Ethereum");
    const [isPaying, setIsPaying] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [receiptId, setReceiptId] = useState<string | null>(null);
    const [receiptStatus, setReceiptStatus] =
        useState<UniFiReceiptStatus | null>(null);
    const [isReceiptStatusChecking, setIsReceiptStatusChecking] =
        useState(false);
    const [receiptStatusError, setReceiptStatusError] = useState<string | null>(
        null,
    );
    const [receiptStatusCheckedAt, setReceiptStatusCheckedAt] =
        useState<Date | null>(null);
    const [receiptAutoRefreshSecondsLeft, setReceiptAutoRefreshSecondsLeft] =
        useState(UNIFI_RECEIPT_REFRESH_INTERVAL_SECONDS);
    const receiptStatusCheckInFlight = useRef(false);

    const [unifiDialogOpen, setUnifiDialogOpen] = useState(false);
    const [unifiSecondsLeft, setUnifiSecondsLeft] =
        useState<number>(UNIFI_PAYMENT_EXPIRY_SECONDS);
    const [unifiSessionId, setUnifiSessionId] = useState<string | null>(null);
    const [
        unifiSessionStartTimestampSeconds,
        setUnifiSessionStartTimestampSeconds,
    ] = useState<number | null>(null);
    const [unifiStatusText, setUnifiStatusText] = useState<string>(
        "Waiting for payment…",
    );
    const [unifiPayUrl, setUnifiPayUrl] = useState<string | null>(null);
    const [unifiWebAppBaseUrl, setUnifiWebAppBaseUrl] = useState<
        string | undefined
    >();
    const [merchantWalletAddress, setMerchantWalletAddress] = useState<
        string | null
    >(null);
    const [unifiConfigError, setUnifiConfigError] = useState<string | null>(
        null,
    );

    useEffect(() => {
        async function loadUniFiRuntimeConfig() {
            try {
                const response = await fetch("/api/config", {
                    headers: { Accept: "application/json" },
                });
                const config = (await response.json()) as {
                    error?: unknown;
                    MERCHANT_WALLET_ADDRESS?: unknown;
                    UNIFI_WEB_APP_BASE_URL?: unknown;
                };
                if (!response.ok) {
                    throw new Error(
                        typeof config.error === "string"
                            ? config.error
                            : "Unable to load the UniFi configuration.",
                    );
                }

                if (typeof config.MERCHANT_WALLET_ADDRESS !== "string") {
                    throw new Error(
                        "Server configuration is missing MERCHANT_WALLET_ADDRESS.",
                    );
                }

                const walletAddress = config.MERCHANT_WALLET_ADDRESS.trim();
                if (!walletAddress) {
                    throw new Error(
                        "Server configuration is missing MERCHANT_WALLET_ADDRESS.",
                    );
                }

                setMerchantWalletAddress(walletAddress);
                setUnifiConfigError(null);

                if (typeof config.UNIFI_WEB_APP_BASE_URL === "string") {
                    const baseUrl = config.UNIFI_WEB_APP_BASE_URL.trim();
                    if (baseUrl) setUnifiWebAppBaseUrl(baseUrl);
                }
            } catch (error) {
                setUnifiConfigError(
                    error instanceof Error
                        ? error.message
                        : "Unable to load the UniFi configuration.",
                );
            }
        }

        void loadUniFiRuntimeConfig();
    }, []);

    useEffect(() => {
        function focusSearch(event: KeyboardEvent) {
            if (
                event.key !== "/" ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                screen !== "marketplace"
            ) {
                return;
            }

            const target = event.target;
            if (
                target instanceof HTMLElement &&
                (target.isContentEditable ||
                    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
            ) {
                return;
            }

            event.preventDefault();
            searchInputRef.current?.focus();
        }

        window.addEventListener("keydown", focusSearch);
        return () => window.removeEventListener("keydown", focusSearch);
    }, [screen]);

    const refreshUniFiReceiptStatus = useCallback(
        async (targetReceiptId: string) => {
            if (receiptStatusCheckInFlight.current) return;

            receiptStatusCheckInFlight.current = true;
            setIsReceiptStatusChecking(true);
            setReceiptStatusError(null);

            try {
                const response = await fetch(
                    `/api/unifi/payment/onchain/receipt/${encodeURIComponent(targetReceiptId)}`,
                    {
                        headers: { Accept: "application/json" },
                        credentials: "same-origin",
                    },
                );

                if (!response.ok) {
                    const detail = (await response.text()).trim();
                    let message = detail;
                    try {
                        const parsed = JSON.parse(detail) as {
                            error?: unknown;
                            message?: unknown;
                        };
                        if (typeof parsed.message === "string") {
                            message = parsed.message;
                        } else if (typeof parsed.error === "string") {
                            message = parsed.error;
                        }
                    } catch {
                        // Keep the user-safe plain-text response.
                    }
                    throw new Error(
                        message ||
                            `Unable to refresh payment status (${response.status}).`,
                    );
                }

                const body = (await response.json()) as {
                    data?: { id?: unknown; status?: unknown };
                };
                if (
                    body.data?.id !== targetReceiptId ||
                    !isUniFiReceiptStatus(body.data.status)
                ) {
                    throw new Error(
                        "UniFi returned an invalid payment status response.",
                    );
                }

                setReceiptStatus(body.data.status);
            } catch (error) {
                setReceiptStatusError(
                    error instanceof Error
                        ? error.message
                        : "Unable to refresh payment status.",
                );
            } finally {
                setReceiptStatusCheckedAt(new Date());
                receiptStatusCheckInFlight.current = false;
                setIsReceiptStatusChecking(false);
            }
        },
        [],
    );

    async function onUnifiCheckStatus() {
        if (!unifiSessionId) return;

        setUnifiStatusText("Checking status…");
        const r = await checkUniFiPaymentStatus(unifiSessionId, {
            proxyBaseUrl: "/api/unifi",
        });

        if (r.state === "paid") {
            setReceiptId(r.receiptId);
            setReceiptStatus(null);
            setReceiptStatusError(null);
            setReceiptStatusCheckedAt(null);
            setUnifiStatusText("Payment submitted. Checking finality…");
            setUnifiDialogOpen(false);
            setIsPaying(false);
            setIsSuccess(true);
            void refreshUniFiReceiptStatus(r.receiptId);
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
        setReceiptStatus(null);
        setReceiptStatusError(null);
        setReceiptStatusCheckedAt(null);
        setReceiptAutoRefreshSecondsLeft(
            UNIFI_RECEIPT_REFRESH_INTERVAL_SECONDS,
        );
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
        setReceiptStatus(null);
        setReceiptStatusError(null);
        setReceiptStatusCheckedAt(null);
        setReceiptAutoRefreshSecondsLeft(
            UNIFI_RECEIPT_REFRESH_INTERVAL_SECONDS,
        );
        setUnifiDialogOpen(false);
        setUnifiSecondsLeft(UNIFI_PAYMENT_EXPIRY_SECONDS);
        setUnifiSessionId(null);
        setUnifiSessionStartTimestampSeconds(null);
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
        if (!unifiDialogOpen || unifiSessionStartTimestampSeconds === null)
            return;

        const expiresAt =
            (unifiSessionStartTimestampSeconds +
                UNIFI_PAYMENT_EXPIRY_SECONDS) *
            1000;

        const syncRemaining = () => {
            const remaining = Math.min(
                UNIFI_PAYMENT_EXPIRY_SECONDS,
                Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)),
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
    }, [unifiDialogOpen, unifiSessionStartTimestampSeconds]);

    const isReceiptAutoRefreshActive =
        isSuccess &&
        method === PaymentMethod.Unifi &&
        Boolean(receiptId) &&
        receiptStatus !== "Finalized" &&
        receiptStatus !== "Failed" &&
        receiptStatus !== "Reorged";

    useEffect(() => {
        if (!isReceiptAutoRefreshActive || !receiptId) return;

        const interval = window.setInterval(() => {
            void refreshUniFiReceiptStatus(receiptId);
        }, UNIFI_RECEIPT_REFRESH_INTERVAL_MS);

        return () => window.clearInterval(interval);
    }, [
        isReceiptAutoRefreshActive,
        receiptId,
        receiptStatusCheckedAt,
        refreshUniFiReceiptStatus,
    ]);

    useEffect(() => {
        if (!isReceiptAutoRefreshActive) {
            setReceiptAutoRefreshSecondsLeft(0);
            return;
        }

        const refreshDeadline =
            (receiptStatusCheckedAt?.getTime() ?? Date.now()) +
            UNIFI_RECEIPT_REFRESH_INTERVAL_MS;
        const syncCountdown = () => {
            setReceiptAutoRefreshSecondsLeft(
                Math.max(
                    0,
                    Math.ceil((refreshDeadline - Date.now()) / 1000),
                ),
            );
        };

        syncCountdown();
        const countdown = window.setInterval(syncCountdown, 1000);
        return () => window.clearInterval(countdown);
    }, [isReceiptAutoRefreshActive, receiptStatusCheckedAt]);

    async function payNow() {
        if (!selected || !pricing) return;

        if (method == PaymentMethod.Unifi) {
            if (!merchantWalletAddress) {
                setUnifiConfigError(
                    "Server configuration is missing MERCHANT_WALLET_ADDRESS.",
                );
                return;
            }

            setIsPaying(true);

            // pricing.total is in USD; for the demo we use 2 decimals.
            // TODO: In production, format based on token decimals.
            const amountStr = pricing.total.toFixed(2); // "12.34"

            const { sessionId, payUrl, startTimestampSeconds } =
                createUniFiPayment({
                    network: unifiNetwork,
                    asset: unifiAsset,
                    recipient: merchantWalletAddress,
                    amount: amountStr,
                    checkoutBaseUrl: unifiWebAppBaseUrl,
                });

            setUnifiSessionId(sessionId);
            setUnifiSessionStartTimestampSeconds(startTimestampSeconds);
            setUnifiSecondsLeft(UNIFI_PAYMENT_EXPIRY_SECONDS);
            setUnifiPayUrl(payUrl);
            window.open(payUrl, "_blank", "noopener,noreferrer");

            // Show a dialog until the same 15-minute deadline used by FliqPay.
            setUnifiStatusText("Waiting for payment…");
            setUnifiDialogOpen(true);
            return; // Don't mark success yet; we do it after status becomes "paid"
        } else {
            setIsPaying(true);
            // fake payment
            await new Promise((r) => setTimeout(r, 900));
        }
        // At this point, we are in the non-UniFi path (the UniFi branch returns early).
        setIsPaying(false);
        setIsSuccess(true);
    }

    const isConfirmation = screen === "payment" && isSuccess;
    const confirmationHeaderTitle =
        method !== PaymentMethod.Unifi || receiptStatus === "Finalized"
            ? "Order confirmed"
            : receiptStatus === "Failed" || receiptStatus === "Reorged"
              ? "Order needs attention"
              : "Payment finalizing...";

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
                <div
                    className={`mx-auto flex max-w-6xl gap-2 px-3 sm:gap-4 sm:px-4 sm:py-4 ${
                        isConfirmation ? "py-2" : "py-3"
                    } ${
                        screen === "marketplace"
                            ? "flex-col items-stretch sm:flex-row sm:items-center sm:justify-between"
                            : "items-center justify-between"
                    }`}
                >
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div
                            className={`flex items-center justify-center rounded-lg bg-slate-900 font-extrabold text-white sm:h-10 sm:w-10 sm:rounded-xl sm:text-sm ${
                                isConfirmation
                                    ? "h-7 w-7 text-[11px]"
                                    : "h-8 w-8 text-xs"
                            }`}
                        >
                            M
                        </div>
                        <div>
                            <div
                                className={`font-extrabold tracking-tight sm:text-base ${
                                    isConfirmation ? "text-[13px]" : "text-sm"
                                }`}
                            >
                                {screen === "marketplace"
                                    ? "FliQMarket"
                                    : isConfirmation
                                      ? confirmationHeaderTitle
                                      : "Checkout"}
                            </div>
                            <div className="text-[9px] text-slate-500 sm:text-sm">
                                {screen === "marketplace"
                                    ? "Lean marketplace demo"
                                    : isConfirmation
                                      ? "FliQ Market"
                                      : "Pay securely (demo)"}
                            </div>
                        </div>
                    </div>

                    {screen === "marketplace" ? (
                        <div className="relative mt-1 w-full sm:mt-0 sm:max-w-md">
                            <input
                                ref={searchInputRef}
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-10 pl-3 text-xs shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-100 sm:rounded-xl sm:pl-4 sm:text-sm"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search products…"
                                aria-label="Search products"
                                aria-keyshortcuts="/"
                            />
                            <kbd
                                aria-hidden="true"
                                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-500 shadow-sm sm:text-xs"
                            >
                                /
                            </kbd>
                        </div>
                    ) : (
                        <button
                            className={`cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.99] sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm ${
                                isConfirmation ? "hidden sm:inline-flex" : "inline-flex"
                            }`}
                            onClick={backToMarketplace}
                        >
                            <i
                                className="bi bi-arrow-left"
                                aria-hidden="true"
                            ></i>
                            Continue shopping
                        </button>
                    )}
                </div>
            </header>

            <main
                className={`mx-auto w-full max-w-6xl px-2.5 sm:px-4 sm:py-6 ${
                    isConfirmation ? "py-2.5" : "py-3"
                }`}
            >
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
                        receiptStatus={receiptStatus}
                        isReceiptStatusChecking={isReceiptStatusChecking}
                        receiptStatusError={receiptStatusError}
                        receiptStatusCheckedAt={receiptStatusCheckedAt}
                        receiptAutoRefreshSecondsLeft={
                            receiptAutoRefreshSecondsLeft
                        }
                        isReceiptAutoRefreshActive={
                            isReceiptAutoRefreshActive
                        }
                        unifiWebAppBaseUrl={unifiWebAppBaseUrl}
                        isUniFiConfigured={Boolean(merchantWalletAddress)}
                        unifiConfigError={unifiConfigError}
                        onPay={payNow}
                        onBack={backToMarketplace}
                        onRefreshReceiptStatus={() => {
                            if (receiptId) {
                                void refreshUniFiReceiptStatus(receiptId);
                            }
                        }}
                    />
                )}
            </main>

            <UniFiPaymentStatusSheet
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {products.map((p) => (
                <div
                    key={p.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-2xl"
                >
                    <img
                        className="h-36 w-full object-cover sm:h-44"
                        src={p.imageUrl}
                        alt={p.title}
                    />
                    <div className="space-y-2 p-3 sm:space-y-3 sm:p-4">
                        <div className="text-sm font-extrabold text-slate-900 sm:text-base">
                            {p.title}
                        </div>
                        <div className="text-xs text-slate-600 sm:text-sm">
                            {p.description}
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="text-base font-extrabold sm:text-lg">
                                {formatUsd(p.priceUsd)}
                            </div>
                            <button
                                className="cursor-pointer rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 active:scale-[0.99] sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm"
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
    receiptStatus,
    isReceiptStatusChecking,
    receiptStatusError,
    receiptStatusCheckedAt,
    receiptAutoRefreshSecondsLeft,
    isReceiptAutoRefreshActive,
    unifiWebAppBaseUrl,
    isUniFiConfigured,
    unifiConfigError,
    onPay,
    onBack,
    onRefreshReceiptStatus,
}: {
    selected: Product | null;
    qty: number;
    setQty: (n: number) => void;
    method: PaymentMethod;
    setMethod: (m: PaymentMethod) => void;
    unifiAsset: UniFiAsset;
    setUnifiAsset: (a: UniFiAsset) => void;
    unifiNetwork: UniFiNetwork;
    setUnifiNetwork: (n: UniFiNetwork) => void;
    pricing: { subtotal: number; tax: number; total: number } | null;
    isPaying: boolean;
    isSuccess: boolean;
    receiptId: string | null;
    receiptStatus: UniFiReceiptStatus | null;
    isReceiptStatusChecking: boolean;
    receiptStatusError: string | null;
    receiptStatusCheckedAt: Date | null;
    receiptAutoRefreshSecondsLeft: number;
    isReceiptAutoRefreshActive: boolean;
    unifiWebAppBaseUrl?: string;
    isUniFiConfigured: boolean;
    unifiConfigError: string | null;
    onPay: () => void;
    onBack: () => void;
    onRefreshReceiptStatus: () => void;
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

    if (isSuccess) {
        return (
            <PaymentSuccessView
                selected={selected}
                qty={qty}
                method={method}
                unifiAsset={unifiAsset}
                unifiNetwork={unifiNetwork}
                pricing={pricing}
                receiptId={receiptId}
                receiptStatus={receiptStatus}
                isReceiptStatusChecking={isReceiptStatusChecking}
                receiptStatusError={receiptStatusError}
                receiptStatusCheckedAt={receiptStatusCheckedAt}
                receiptAutoRefreshSecondsLeft={
                    receiptAutoRefreshSecondsLeft
                }
                isReceiptAutoRefreshActive={isReceiptAutoRefreshActive}
                unifiWebAppBaseUrl={unifiWebAppBaseUrl}
                onBack={onBack}
                onRefreshReceiptStatus={onRefreshReceiptStatus}
            />
        );
    }

    const disableEdits = isPaying;
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

                    <UniFiPaymentOption
                        radioName="payment"
                        selected={method === PaymentMethod.Unifi}
                        onSelect={() => setMethod(PaymentMethod.Unifi)}
                        disabled={disableEdits}
                        value={{
                            asset: unifiAsset,
                            network: unifiNetwork,
                        }}
                        onChange={({ asset, network }) => {
                            setUnifiAsset(asset);
                            setUnifiNetwork(network);
                        }}
                    />
                </div>

                {method === PaymentMethod.Unifi && unifiConfigError ? (
                    <div
                        className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                        role="alert"
                    >
                        UniFi payment is unavailable: {unifiConfigError}
                    </div>
                ) : null}

                <button
                    className="mt-3 w-full cursor-pointer rounded-xl bg-slate-900 px-3 py-2.5 text-[13px] font-extrabold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99] sm:mt-4 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                    onClick={onPay}
                    disabled={
                        isPaying ||
                        (method === PaymentMethod.Unifi && !isUniFiConfigured)
                    }
                >
                    {isPaying
                        ? "Processing…"
                        : `Pay ${formatUsd(pricing.total)}`}
                </button>
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

function PaymentSuccessView({
    selected,
    qty,
    method,
    unifiAsset,
    unifiNetwork,
    pricing,
    receiptId,
    receiptStatus,
    isReceiptStatusChecking,
    receiptStatusError,
    receiptStatusCheckedAt,
    receiptAutoRefreshSecondsLeft,
    isReceiptAutoRefreshActive,
    unifiWebAppBaseUrl,
    onBack,
    onRefreshReceiptStatus,
}: {
    selected: Product;
    qty: number;
    method: PaymentMethod;
    unifiAsset: UniFiAsset;
    unifiNetwork: UniFiNetwork;
    pricing: { subtotal: number; tax: number; total: number };
    receiptId: string | null;
    receiptStatus: UniFiReceiptStatus | null;
    isReceiptStatusChecking: boolean;
    receiptStatusError: string | null;
    receiptStatusCheckedAt: Date | null;
    receiptAutoRefreshSecondsLeft: number;
    isReceiptAutoRefreshActive: boolean;
    unifiWebAppBaseUrl?: string;
    onBack: () => void;
    onRefreshReceiptStatus: () => void;
}) {
    const isUniFiPayment = method === PaymentMethod.Unifi;
    const isUniFiFinalized =
        isUniFiPayment && receiptStatus === "Finalized";
    const isUniFiUnsuccessful =
        isUniFiPayment &&
        (receiptStatus === "Failed" || receiptStatus === "Reorged");
    const isOrderConfirmed = !isUniFiPayment || isUniFiFinalized;
    const paymentMethodLabel =
        method === PaymentMethod.Debit
            ? "Debit Card"
            : method === PaymentMethod.Credit
              ? "Credit Card"
              : method === PaymentMethod.Upi
                ? "UPI"
                : "UniFi";
    const statusTitle = isOrderConfirmed
        ? "Payment successful"
        : isUniFiUnsuccessful
          ? "Payment not finalized"
          : "Order confirmation in progress";
    const statusDescription = isOrderConfirmed
        ? "Your order is confirmed."
        : receiptStatus === "Confirmed"
          ? "Your payment is confirmed on-chain and is now waiting for finality."
          : isUniFiUnsuccessful
            ? receiptStatus === "Reorged"
                ? "The confirmed transaction left the canonical chain. Your order has not been confirmed."
                : "The payment failed before finalization. Your order has not been confirmed."
            : "Your payment was submitted and is being finalized on-chain. We'll confirm your order after finality.";
    const statusTheme = isOrderConfirmed
        ? {
              section: "border-emerald-200 bg-emerald-50/80",
              icon: "bg-emerald-600 bi-check-lg",
          }
        : isUniFiUnsuccessful
          ? {
                section: "border-red-200 bg-red-50/80",
                icon: "bg-red-600 bi-exclamation-lg",
            }
          : {
                section: "border-amber-200 bg-amber-50/80",
                icon: "bg-amber-500 bi-hourglass-split",
            };
    const receiptStatusLabel =
        receiptStatus === "Processing"
            ? "Payment submitted"
            : receiptStatus === "Confirmed"
              ? "Confirmed on-chain"
              : receiptStatus === "Finalized"
                ? "Finalized on-chain"
                : receiptStatus === "Failed"
                  ? "Payment failed"
                  : receiptStatus === "Reorged"
                    ? "Payment reorged"
                    : "Checking payment finality";
    const refreshRingRadius = 21;
    const refreshRingCircumference = 2 * Math.PI * refreshRingRadius;
    const refreshProgress = isReceiptAutoRefreshActive
        ? Math.min(
              1,
              Math.max(
                  0,
                  receiptAutoRefreshSecondsLeft /
                      UNIFI_RECEIPT_REFRESH_INTERVAL_SECONDS,
              ),
          )
        : 0;
    const refreshRingOffset =
        refreshRingCircumference * (1 - refreshProgress);

    return (
        <div className="space-y-2.5 sm:space-y-5">
            <section
                className={`flex items-center gap-3 rounded-lg border p-3 sm:gap-6 sm:rounded-2xl sm:p-7 ${statusTheme.section}`}
                aria-labelledby="payment-success-title"
            >
                <div
                    className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-xl text-white shadow-sm sm:h-16 sm:w-16 sm:text-3xl ${statusTheme.icon.split(" ")[0]}`}
                >
                    <i
                        className={`bi ${statusTheme.icon.split(" ")[1]}`}
                        aria-hidden="true"
                    ></i>
                </div>
                <div className="min-w-0">
                    <h1
                        id="payment-success-title"
                        className="text-lg font-extrabold tracking-tight text-slate-950 sm:text-3xl"
                    >
                        {statusTitle}
                    </h1>
                    <p className="text-xs text-slate-600 sm:mt-1 sm:text-lg">
                        {statusDescription}
                    </p>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-2.5 sm:gap-5 lg:grid-cols-2">
                <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-6">
                    <h2 className="text-sm font-extrabold text-slate-950 sm:text-lg">
                        Order summary
                    </h2>

                    <div className="mt-3 flex items-center gap-2.5 border-b border-slate-200 pb-3 sm:mt-4 sm:gap-4 sm:pb-5">
                        <img
                            className="h-14 w-14 rounded-lg object-cover sm:h-20 sm:w-20 sm:rounded-2xl"
                            src={selected.imageUrl}
                            alt={selected.title}
                        />
                        <div className="min-w-0">
                            <div className="truncate text-xs font-extrabold text-slate-950 sm:text-base">
                                {selected.title}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500 sm:text-sm">
                                {formatUsd(selected.priceUsd)} each
                            </div>
                        </div>
                    </div>

                    <dl className="mt-3 space-y-2 text-xs sm:mt-4 sm:space-y-2.5 sm:text-base">
                        <div className="flex items-center justify-between gap-4">
                            <dt className="text-slate-600">Quantity</dt>
                            <dd className="font-semibold text-slate-950">{qty}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <dt className="text-slate-600">Subtotal</dt>
                            <dd className="font-semibold text-slate-950">
                                {formatUsd(pricing.subtotal)}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <dt className="text-slate-600">Tax</dt>
                            <dd className="font-semibold text-slate-950">
                                {formatUsd(pricing.tax)}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-2.5 font-extrabold sm:pt-3">
                            <dt>Total</dt>
                            <dd>{formatUsd(pricing.total)}</dd>
                        </div>
                    </dl>
                </section>

                <section className="flex flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-6">
                    <h2 className="text-sm font-extrabold text-slate-950 sm:text-lg">
                        Payment details
                    </h2>

                    <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-violet-200 bg-violet-50/70 p-2.5 sm:mt-4 sm:gap-4 sm:rounded-2xl sm:p-4">
                        {isUniFiPayment ? (
                            <img
                                className="h-9 w-9 flex-none rounded-full object-cover sm:h-12 sm:w-12"
                                src="/unifi-icon.svg"
                                alt="UniFi"
                            />
                        ) : (
                            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-slate-900 text-base text-white sm:h-12 sm:w-12 sm:text-lg">
                                <i
                                    className={`bi ${
                                        method === PaymentMethod.Upi
                                            ? "bi-phone"
                                            : "bi-credit-card"
                                    }`}
                                    aria-hidden="true"
                                ></i>
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="text-xs font-extrabold text-slate-950 sm:text-base">
                                {isUniFiUnsuccessful
                                    ? `Attempted with ${paymentMethodLabel}`
                                    : isUniFiPayment && !isUniFiFinalized
                                      ? `Submitted with ${paymentMethodLabel}`
                                      : `Paid with ${paymentMethodLabel}`}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500 sm:text-sm">
                                {isUniFiPayment
                                    ? `${unifiAsset} · ${unifiNetwork}`
                                    : "Demo payment"}
                            </div>
                        </div>
                    </div>

                    {isUniFiPayment && receiptId ? (
                        <div
                            className="mt-3 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 sm:mt-4 sm:rounded-xl sm:p-3"
                        >
                            <button
                                type="button"
                                className="group relative inline-flex h-12 w-12 flex-none cursor-pointer items-center justify-center rounded-full text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60"
                                onClick={onRefreshReceiptStatus}
                                disabled={isReceiptStatusChecking}
                                aria-label="Refresh payment finality now"
                                title={
                                    isReceiptAutoRefreshActive
                                        ? `Refresh now · next automatic check in ${formatCountdown(receiptAutoRefreshSecondsLeft)}`
                                        : "Refresh payment finality now"
                                }
                            >
                                <span
                                    className="absolute inset-1 rounded-full border border-blue-100 bg-white shadow-sm transition group-hover:bg-blue-50"
                                    aria-hidden="true"
                                />
                                <i
                                    className={`bi bi-arrow-clockwise relative z-10 text-base ${isReceiptStatusChecking ? "animate-spin" : ""}`}
                                    aria-hidden="true"
                                ></i>
                                <svg
                                    className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
                                    viewBox="0 0 48 48"
                                    aria-hidden="true"
                                >
                                    <defs>
                                        <linearGradient
                                            id="unifi-refresh-ring-gradient"
                                            x1="0"
                                            y1="0"
                                            x2="48"
                                            y2="48"
                                            gradientUnits="userSpaceOnUse"
                                        >
                                            <stop stopColor="#2563EB" />
                                            <stop
                                                offset="1"
                                                stopColor="#7C3AED"
                                            />
                                        </linearGradient>
                                    </defs>
                                    <circle
                                        cx="24"
                                        cy="24"
                                        r={refreshRingRadius}
                                        fill="none"
                                        stroke="#BFDBFE"
                                        strokeWidth="3"
                                    />
                                    {isReceiptAutoRefreshActive ? (
                                        <circle
                                            cx="24"
                                            cy="24"
                                            r={refreshRingRadius}
                                            fill="none"
                                            stroke="url(#unifi-refresh-ring-gradient)"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeDasharray={
                                                refreshRingCircumference
                                            }
                                            strokeDashoffset={refreshRingOffset}
                                            style={{
                                                transition:
                                                    "stroke-dashoffset 1s linear",
                                            }}
                                        />
                                    ) : null}
                                </svg>
                            </button>
                            <div className="min-w-0 text-[11px] text-blue-950 sm:text-sm">
                                <div
                                    className="font-extrabold"
                                    role="status"
                                    aria-live="polite"
                                >
                                    {isReceiptStatusChecking
                                        ? "Refreshing payment status…"
                                        : receiptStatusLabel}
                                </div>
                                <div className="mt-0.5 text-blue-800">
                                    Status checks run automatically every 15
                                    minutes. Use the refresh button for an
                                    immediate check.
                                </div>
                                {isReceiptAutoRefreshActive ? (
                                    <div
                                        className="mt-1 font-bold tabular-nums text-blue-700"
                                        aria-hidden="true"
                                    >
                                        Next automatic check in{" "}
                                        {formatCountdown(
                                            receiptAutoRefreshSecondsLeft,
                                        )}
                                    </div>
                                ) : null}
                                {receiptStatusCheckedAt ? (
                                    <div className="mt-1 text-[10px] font-semibold text-blue-700 sm:text-xs">
                                        Last checked at{" "}
                                        {receiptStatusCheckedAt.toLocaleTimeString(
                                            [],
                                            {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            },
                                        )}
                                    </div>
                                ) : null}
                                {receiptStatusError ? (
                                    <div
                                        className="mt-1 font-semibold text-red-700"
                                        role="alert"
                                    >
                                        {receiptStatusError} Your order remains
                                        unconfirmed until UniFi reports
                                        finality.
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    <div className="mt-3 flex flex-1 flex-col justify-end border-t border-slate-200 pt-3 sm:mt-5 sm:pt-5">
                        <button
                            className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.99] sm:min-h-11 sm:rounded-xl sm:px-4 sm:py-3 sm:text-base"
                            onClick={onBack}
                        >
                            Continue shopping
                        </button>

                        {receiptId ? (
                            <div className="mt-1 text-center">
                                <UniFiReceiptLink
                                    receiptId={receiptId}
                                    checkoutBaseUrl={unifiWebAppBaseUrl}
                                    className="!mt-2 !inline-flex !items-center !gap-1.5 !text-xs !font-extrabold !text-indigo-700 hover:!text-indigo-800 sm:!mt-3 sm:!gap-2 sm:!text-sm [&>span:last-child]:hidden"
                                >
                                    View UniFi receipt
                                    <i
                                        className="bi bi-box-arrow-up-right text-xs"
                                        aria-hidden="true"
                                    ></i>
                                </UniFiReceiptLink>
                            </div>
                        ) : null}
                    </div>
                </section>
            </div>
        </div>
    );
}
