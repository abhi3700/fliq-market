import { useEffect, useMemo, useRef, useState } from "react";
import { products } from "./data/products";
import { PaymentMethod, type Product } from "./types";
import { formatUsd } from "./utils/money";
import {
    UniFiPaymentOption,
    UniFiPaymentStatusSheet,
    UniFiReceiptLink,
    UniFiReceiptStatusCard,
    useUniFiPayment,
} from "unifi-pay-widget/react";
import {
    UNIFI_PAYMENT_EXPIRY_SECONDS,
    type UniFiAsset,
    type UniFiNetwork,
    type UniFiPaymentReceipt,
    type UniFiReceiptStatus,
} from "unifi-pay-widget";
import { getOrder, listOrders, putOrder } from "./orders/db";
import {
    createBrowserOrder,
    updateOrderReceiptStatus,
    type BrowserOrder,
    type StoredPaymentStatus,
} from "./orders/model";
import { OrdersView } from "./orders/OrdersView";
import { PaymentMethodSummary } from "./components/PaymentMethodSummary";

type Screen = "marketplace" | "payment" | "orders";

function calcTax(subtotal: number): number {
    const TAX_RATE = 0.0825; // 8.25% demo
    return subtotal * TAX_RATE;
}

function sortOrders(orders: BrowserOrder[]): BrowserOrder[] {
    return [...orders].sort(
        (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
    );
}

function storageErrorMessage(error: unknown): string {
    const detail =
        error instanceof Error ? error.message : "Unknown browser database error.";
    return `Order history is unavailable: ${detail}`;
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
    const [orders, setOrders] = useState<BrowserOrder[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [orderDbError, setOrderDbError] = useState<string | null>(null);
    const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
    const activeOrderIdRef = useRef<string | null>(null);
    const activeOrderRef = useRef<BrowserOrder | null>(null);
    const orderWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
    const [unifiWebAppBaseUrl, setUnifiWebAppBaseUrl] = useState<
        string | undefined
    >();
    const [merchantWalletAddress, setMerchantWalletAddress] = useState<
        string | null
    >(null);
    const [paymentStatusPollIntervalMs, setPaymentStatusPollIntervalMs] =
        useState<number | null>(null);
    const [unifiConfigError, setUnifiConfigError] = useState<string | null>(
        null,
    );
    const unifiPayment = useUniFiPayment({
        proxyBaseUrl: "/api/unifi",
        checkoutBaseUrl: unifiWebAppBaseUrl,
        expirySeconds: UNIFI_PAYMENT_EXPIRY_SECONDS,
        statusPollIntervalMs: paymentStatusPollIntervalMs,
        closeOnReceipt: true,
        closeOnExpire: true,
        onReceiptDetected: (nextReceiptId, session) => {
            setReceiptId(nextReceiptId);
            setReceiptStatus(null);
            setIsPaying(false);
            setIsSuccess(true);
            void persistCheckoutOrder("processing", {
                receiptId: nextReceiptId,
                sessionId: session.sessionId,
            });
        },
        onExpired: () => setIsPaying(false),
        onError: (error) => setUnifiConfigError(error.message),
    });

    useEffect(() => {
        let cancelled = false;

        void listOrders()
            .then((storedOrders) => {
                if (cancelled) return;
                setOrders((current) => {
                    const merged = new Map(
                        storedOrders.map((order) => [order.id, order]),
                    );
                    current.forEach((order) => merged.set(order.id, order));
                    return sortOrders([...merged.values()]);
                });
                setOrderDbError(null);
            })
            .catch((error: unknown) => {
                if (!cancelled) setOrderDbError(storageErrorMessage(error));
            })
            .finally(() => {
                if (!cancelled) setOrdersLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

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
                    PAYMENT_STATUS_POLL_INTERVAL?: unknown;
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

                if (config.PAYMENT_STATUS_POLL_INTERVAL === undefined) {
                    setPaymentStatusPollIntervalMs(null);
                } else if (
                    typeof config.PAYMENT_STATUS_POLL_INTERVAL === "number" &&
                    Number.isSafeInteger(config.PAYMENT_STATUS_POLL_INTERVAL) &&
                    config.PAYMENT_STATUS_POLL_INTERVAL > 0
                ) {
                    setPaymentStatusPollIntervalMs(
                        config.PAYMENT_STATUS_POLL_INTERVAL * 1000,
                    );
                } else {
                    throw new Error(
                        "Server configuration has an invalid PAYMENT_STATUS_POLL_INTERVAL.",
                    );
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

    function closeUnifiDialog() {
        setReceiptId(null);
        setReceiptStatus(null);
        unifiPayment.reset();
        setIsPaying(false);
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

    function ensureActiveOrderId(): string {
        if (activeOrderIdRef.current) return activeOrderIdRef.current;
        const id = crypto.randomUUID();
        activeOrderIdRef.current = id;
        setCurrentOrderId(id);
        return id;
    }

    function updateOrderList(order: BrowserOrder) {
        setOrders((current) =>
            sortOrders([order, ...current.filter((item) => item.id !== order.id)]),
        );
    }

    function queueOrderWrite(operation: () => Promise<void>): Promise<void> {
        const write = orderWriteQueueRef.current.then(operation);
        orderWriteQueueRef.current = write.catch((error: unknown) => {
            setOrderDbError(storageErrorMessage(error));
        });
        return orderWriteQueueRef.current;
    }

    function persistCheckoutOrder(
        status: StoredPaymentStatus,
        identifiers: { receiptId?: string; sessionId?: string } = {},
    ): Promise<void> {
        if (!selected || !pricing) return Promise.resolve();

        const orderId = ensureActiveOrderId();
        const captured = {
            product: selected,
            quantity: qty,
            pricing,
            method,
            asset: method === PaymentMethod.Unifi ? unifiAsset : null,
            network: method === PaymentMethod.Unifi ? unifiNetwork : null,
        };

        return queueOrderWrite(async () => {
            const order = createBrowserOrder({
                id: orderId,
                createdAt: new Date(),
                product: captured.product,
                quantity: captured.quantity,
                pricing: captured.pricing,
                payment: {
                    method: captured.method,
                    status,
                    receiptId: identifiers.receiptId ?? null,
                    sessionId: identifiers.sessionId ?? null,
                    asset: captured.asset,
                    network: captured.network,
                },
            });
            activeOrderRef.current = order;
            await putOrder(order);
            updateOrderList(order);
            setOrderDbError(null);
        });
    }

    function queueReceiptUpdate(
        orderId: string,
        status: UniFiReceiptStatus,
        receipt: UniFiPaymentReceipt,
    ): Promise<void> {
        return queueOrderWrite(async () => {
            const current =
                activeOrderIdRef.current === orderId
                    ? activeOrderRef.current
                    : await getOrder(orderId);
            if (!current) return;

            const updated = updateOrderReceiptStatus(current, status, receipt);
            if (activeOrderIdRef.current === orderId) {
                activeOrderRef.current = updated;
            }
            await putOrder(updated);
            updateOrderList(updated);
            setOrderDbError(null);
        });
    }

    function handleReceiptStatusChange(
        status: UniFiReceiptStatus,
        receipt: UniFiPaymentReceipt,
    ) {
        setReceiptStatus(status);
        const orderId = activeOrderIdRef.current;
        if (orderId) void queueReceiptUpdate(orderId, status, receipt);
    }

    function handleStoredOrderReceiptStatus(
        orderId: string,
        status: UniFiReceiptStatus,
        receipt: UniFiPaymentReceipt,
    ) {
        if (activeOrderIdRef.current === orderId) setReceiptStatus(status);
        void queueReceiptUpdate(orderId, status, receipt);
    }

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
        setCurrentOrderId(null);
        activeOrderIdRef.current = null;
        activeOrderRef.current = null;
        unifiPayment.reset();
        setScreen("payment");
    }

    function backToMarketplace() {
        setScreen("marketplace");
        // keep selection? usually no; but keeping it is also fine.
        // We'll keep selected so user can go back & checkout again quickly if desired.
    }

    function viewOrders() {
        setScreen("orders");
    }

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

            const payment = unifiPayment.startPayment({
                network: unifiNetwork,
                asset: unifiAsset,
                recipient: merchantWalletAddress,
                amount: amountStr,
            });
            if (!payment) setIsPaying(false);
            return; // Don't mark success yet; we do it after status becomes "paid"
        } else {
            setIsPaying(true);
            // fake payment
            await new Promise((r) => setTimeout(r, 900));
        }
        // At this point, we are in the non-UniFi path (the UniFi branch returns early).
        await persistCheckoutOrder("finalized");
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
                                    : screen === "orders"
                                      ? "Your orders"
                                    : isConfirmation
                                      ? confirmationHeaderTitle
                                      : "Checkout"}
                            </div>
                            <div className="text-[9px] text-slate-500 sm:text-sm">
                                {screen === "marketplace"
                                    ? "Lean marketplace demo"
                                    : screen === "orders"
                                      ? "Shipment tracking"
                                    : isConfirmation
                                      ? "FliQ Market"
                                      : "Pay securely (demo)"}
                            </div>
                        </div>
                    </div>

                    {screen === "marketplace" ? (
                        <div className="mt-1 flex w-full items-center gap-2 sm:mt-0 sm:max-w-xl">
                            <div className="relative min-w-0 flex-1">
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
                            <button
                                className="inline-flex min-h-8 flex-none cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-extrabold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.99] sm:rounded-xl sm:px-3.5 sm:text-sm"
                                onClick={viewOrders}
                            >
                                <i className="bi bi-bag" aria-hidden="true" />
                                <span>Orders</span>
                                {orders.length > 0 ? (
                                    <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] leading-none text-white sm:text-[10px]">
                                        {orders.length}
                                    </span>
                                ) : null}
                            </button>
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
                            {screen === "orders"
                                ? "Browse products"
                                : "Continue shopping"}
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
                ) : screen === "orders" ? (
                    <OrdersView
                        orders={orders}
                        loading={ordersLoading}
                        error={orderDbError}
                        onBrowse={backToMarketplace}
                        unifiWebAppBaseUrl={unifiWebAppBaseUrl}
                        onReceiptStatusChange={
                            handleStoredOrderReceiptStatus
                        }
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
                        unifiWebAppBaseUrl={unifiWebAppBaseUrl}
                        isUniFiConfigured={Boolean(merchantWalletAddress)}
                        unifiConfigError={unifiConfigError}
                        hasStoredOrder={
                            currentOrderId !== null &&
                            orders.some((order) => order.id === currentOrderId)
                        }
                        orderDbError={orderDbError}
                        onPay={payNow}
                        onBack={backToMarketplace}
                        onViewOrders={viewOrders}
                        onReceiptStatusChange={handleReceiptStatusChange}
                    />
                )}
            </main>

            <UniFiPaymentStatusSheet
                open={unifiPayment.statusOpen}
                secondsLeft={unifiPayment.secondsLeft}
                statusText={unifiPayment.statusText}
                payUrl={unifiPayment.session?.payUrl}
                checking={unifiPayment.checking}
                statusPollIntervalMs={paymentStatusPollIntervalMs}
                autoCheckSecondsLeft={unifiPayment.autoCheckSecondsLeft}
                autoCheckActive={unifiPayment.autoCheckActive}
                lastCheckedAt={unifiPayment.lastCheckedAt}
                onCheckStatus={unifiPayment.checkStatus}
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
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 sm:text-xs">
                            <i className="bi bi-truck" aria-hidden="true" />
                            Est. delivery in {p.estimatedDeliveryDays}{" "}
                            {p.estimatedDeliveryDays === 1 ? "day" : "days"}
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
    unifiWebAppBaseUrl,
    isUniFiConfigured,
    unifiConfigError,
    hasStoredOrder,
    orderDbError,
    onPay,
    onBack,
    onViewOrders,
    onReceiptStatusChange,
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
    unifiWebAppBaseUrl?: string;
    isUniFiConfigured: boolean;
    unifiConfigError: string | null;
    hasStoredOrder: boolean;
    orderDbError: string | null;
    onPay: () => void;
    onBack: () => void;
    onViewOrders: () => void;
    onReceiptStatusChange: (
        status: UniFiReceiptStatus,
        receipt: UniFiPaymentReceipt,
    ) => void;
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
                unifiWebAppBaseUrl={unifiWebAppBaseUrl}
                hasStoredOrder={hasStoredOrder}
                orderDbError={orderDbError}
                onBack={onBack}
                onViewOrders={onViewOrders}
                onReceiptStatusChange={onReceiptStatusChange}
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
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500 sm:text-xs">
                            <i className="bi bi-truck" aria-hidden="true" />
                            Est. delivery in {selected.estimatedDeliveryDays}{" "}
                            {selected.estimatedDeliveryDays === 1
                                ? "day"
                                : "days"}
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
    unifiWebAppBaseUrl,
    hasStoredOrder,
    orderDbError,
    onBack,
    onViewOrders,
    onReceiptStatusChange,
}: {
    selected: Product;
    qty: number;
    method: PaymentMethod;
    unifiAsset: UniFiAsset;
    unifiNetwork: UniFiNetwork;
    pricing: { subtotal: number; tax: number; total: number };
    receiptId: string | null;
    receiptStatus: UniFiReceiptStatus | null;
    unifiWebAppBaseUrl?: string;
    hasStoredOrder: boolean;
    orderDbError: string | null;
    onBack: () => void;
    onViewOrders: () => void;
    onReceiptStatusChange: (
        status: UniFiReceiptStatus,
        receipt: UniFiPaymentReceipt,
    ) => void;
}) {
    const isUniFiPayment = method === PaymentMethod.Unifi;
    const isUniFiFinalized =
        isUniFiPayment && receiptStatus === "Finalized";
    const isUniFiUnsuccessful =
        isUniFiPayment &&
        (receiptStatus === "Failed" || receiptStatus === "Reorged");
    const isOrderConfirmed = !isUniFiPayment || isUniFiFinalized;
    const statusTitle = isOrderConfirmed
        ? "Payment successful"
        : isUniFiUnsuccessful
          ? "Payment not finalized"
          : "Order confirmation in progress";
    const statusDescription = isOrderConfirmed
        ? "Your order is confirmed and is now being prepared."
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
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500 sm:text-xs">
                                <i className="bi bi-truck" aria-hidden="true" />
                                {isOrderConfirmed
                                    ? "Dispatches after 5 min preparation"
                                    : `Est. delivery ${selected.estimatedDeliveryDays} ${
                                          selected.estimatedDeliveryDays === 1
                                              ? "day"
                                              : "days"
                                      } after finality`}
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

                    <PaymentMethodSummary
                        className="mt-3 sm:mt-4"
                        method={method}
                        status={
                            isUniFiUnsuccessful
                                ? "attempted"
                                : isUniFiPayment && !isUniFiFinalized
                                  ? "submitted"
                                  : "paid"
                        }
                        asset={unifiAsset}
                        network={unifiNetwork}
                        receiptId={receiptId}
                        checkoutBaseUrl={unifiWebAppBaseUrl}
                    />

                    {isUniFiPayment && receiptId ? (
                        <UniFiReceiptStatusCard
                            receiptId={receiptId}
                            proxyBaseUrl="/api/unifi"
                            onStatusChange={onReceiptStatusChange}
                            errorHelpText="Your order remains unconfirmed until UniFi reports finality."
                        />
                    ) : null}

                    {orderDbError ? (
                        <div
                            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 sm:mt-4 sm:rounded-xl sm:text-xs"
                            role="alert"
                        >
                            {orderDbError}
                        </div>
                    ) : null}

                    <div className="mt-3 flex flex-1 flex-col justify-end border-t border-slate-200 pt-3 sm:mt-5 sm:pt-5">
                        {hasStoredOrder ? (
                            <button
                                className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.99] sm:min-h-11 sm:rounded-xl sm:px-4 sm:py-3 sm:text-base"
                                onClick={onViewOrders}
                            >
                                <i className="bi bi-truck" aria-hidden="true" />
                                Track order
                            </button>
                        ) : null}

                        <button
                            className={`${hasStoredOrder ? "mt-2" : ""} inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 active:scale-[0.99] sm:min-h-11 sm:rounded-xl sm:px-4 sm:py-3 sm:text-base`}
                            onClick={onBack}
                        >
                            Continue shopping
                        </button>

                        {receiptId ? (
                            <div className="mt-1 text-center">
                                <UniFiReceiptLink
                                    receiptId={receiptId}
                                    checkoutBaseUrl={unifiWebAppBaseUrl}
                                    className="mt-2! inline-flex! items-center! gap-1.5! text-xs! font-extrabold! text-indigo-700! hover:text-indigo-800! sm:mt-3! sm:gap-2! sm:text-sm! [&>span:last-child]:hidden"
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
