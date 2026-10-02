import { useEffect, useState } from "react";
import { UniFiReceiptStatusCard } from "unifi-pay-widget/react";
import type {
    UniFiPaymentReceipt,
    UniFiReceiptStatus,
} from "unifi-pay-widget";
import { formatUsd } from "../utils/money";
import { PaymentMethodSummary } from "../components/PaymentMethodSummary";
import {
    getShipmentProgress,
    type BrowserOrder,
    type ShipmentStatus,
} from "./model";

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
});
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

const TRACKING_STEPS = [
    { label: "Paid", icon: "bi-credit-card" },
    { label: "Preparing", icon: "bi-box-seam" },
    { label: "Dispatched", icon: "bi-truck" },
    { label: "Delivered", icon: "bi-house-check" },
] as const;

const STATUS_STEP: Record<ShipmentStatus, number> = {
    payment_processing: 0,
    payment_failed: 0,
    preparing: 1,
    dispatched: 2,
    delivered: 3,
};

function orderNumber(order: BrowserOrder): string {
    return `FM-${order.id.replaceAll("-", "").slice(-8).toUpperCase()}`;
}

function remainingTime(target: Date, now: Date): string {
    const remainingMs = Math.max(0, target.getTime() - now.getTime());
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m ${seconds}s remaining`;
}

function statusCopy(order: BrowserOrder, now: Date) {
    const progress = getShipmentProgress(order, now);
    if (progress.status === "payment_failed") {
        return {
            title:
                order.payment.status === "reorged"
                    ? "Payment reorganized"
                    : "Payment failed",
            description: "Shipment has not started.",
            tone: "border-red-200 bg-red-50 text-red-800",
        };
    }
    if (progress.status === "payment_processing") {
        return {
            title: "Payment finalizing",
            description:
                "Preparing starts after the payment reaches finality.",
            tone: "border-amber-200 bg-amber-50 text-amber-800",
        };
    }
    if (progress.status === "preparing" && progress.dispatchAt) {
        return {
            title: "Preparing your order",
            description: `Dispatches in ${remainingTime(progress.dispatchAt, now)}`,
            tone: "border-blue-200 bg-blue-50 text-blue-800",
        };
    }
    if (progress.status === "dispatched" && progress.expectedDeliveryAt) {
        return {
            title: "Dispatched",
            description: `Expected by ${DATE_FORMAT.format(progress.expectedDeliveryAt)} · ${remainingTime(progress.expectedDeliveryAt, now)}`,
            tone: "border-indigo-200 bg-indigo-50 text-indigo-800",
        };
    }
    return {
        title: "Delivered",
        description: progress.expectedDeliveryAt
            ? `Marked delivered on ${DATE_FORMAT.format(progress.expectedDeliveryAt)}`
            : "Delivery complete.",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
}

function TrackingSteps({ order, now }: { order: BrowserOrder; now: Date }) {
    const status = getShipmentProgress(order, now).status;
    const activeStep = STATUS_STEP[status];
    const paymentFailed = status === "payment_failed";

    return (
        <ol
            className="mt-4 grid grid-cols-4 gap-1 sm:mt-5 sm:gap-2"
            aria-label="Shipment progress"
        >
            {TRACKING_STEPS.map((step, index) => {
                const complete = !paymentFailed && index < activeStep;
                const active = index === activeStep;
                const stepTone = paymentFailed && index === 0
                    ? "border-red-500 bg-red-500 text-white"
                    : complete
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-400";
                return (
                    <li key={step.label} className="relative min-w-0 text-center">
                        {index > 0 ? (
                            <span
                                className={`absolute top-4 right-1/2 h-0.5 w-full sm:top-5 ${
                                    complete || active
                                        ? "bg-emerald-500"
                                        : "bg-slate-200"
                                }`}
                                aria-hidden="true"
                            />
                        ) : null}
                        <span
                            className={`relative z-1 mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-xs sm:h-10 sm:w-10 sm:text-sm ${stepTone}`}
                        >
                            <i
                                className={`bi ${complete ? "bi-check-lg" : step.icon}`}
                                aria-hidden="true"
                            />
                        </span>
                        <span
                            className={`mt-1 block truncate text-[9px] font-bold sm:mt-2 sm:text-xs ${
                                complete || active
                                    ? "text-slate-800"
                                    : "text-slate-400"
                            }`}
                        >
                            {step.label}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

function OrderCard({
    order,
    now,
    unifiWebAppBaseUrl,
    onReceiptStatusChange,
}: {
    order: BrowserOrder;
    now: Date;
    unifiWebAppBaseUrl?: string;
    onReceiptStatusChange: (
        orderId: string,
        status: UniFiReceiptStatus,
        receipt: UniFiPaymentReceipt,
    ) => void;
}) {
    const progress = getShipmentProgress(order, now);
    const copy = statusCopy(order, now);
    const isPendingUniFi =
        order.payment.method === "unifi" &&
        order.payment.status === "processing" &&
        Boolean(order.payment.receiptId);
    const paymentPresentationStatus =
        order.payment.status === "failed" ||
        order.payment.status === "reorged"
            ? "attempted"
            : order.payment.status === "processing"
              ? "submitted"
              : "paid";

    return (
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-5 sm:py-3.5">
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                        Order {orderNumber(order)}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">
                        Placed {DATE_TIME_FORMAT.format(new Date(order.createdAt))}
                    </div>
                </div>
                <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold sm:text-xs ${copy.tone}`}
                >
                    {copy.title}
                </span>
            </div>

            <div className="p-3 sm:p-5">
                <div className="flex items-center gap-3 sm:gap-4">
                    <img
                        className="h-14 w-14 flex-none rounded-lg object-cover sm:h-20 sm:w-20 sm:rounded-xl"
                        src={order.product.imageUrl}
                        alt={order.product.title}
                    />
                    <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-extrabold text-slate-950 sm:text-base">
                            {order.product.title}
                        </h2>
                        <p className="mt-0.5 text-[11px] text-slate-500 sm:text-sm">
                            Qty {order.quantity} · {formatUsd(order.totalUsd)}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-700 sm:text-sm">
                            {copy.description}
                        </p>
                    </div>
                </div>

                <TrackingSteps order={order} now={now} />

                {progress.expectedDeliveryAt ? (
                    <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] sm:mt-5 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm">
                        <span className="text-slate-600">
                            {progress.status === "delivered"
                                ? "Delivered"
                                : "Estimated delivery"}
                        </span>
                        <span className="font-extrabold text-slate-900">
                            {DATE_FORMAT.format(progress.expectedDeliveryAt)}
                        </span>
                    </div>
                ) : null}

                <div className="mt-4 border-t border-slate-200 pt-4 sm:mt-5 sm:pt-5">
                    <h3 className="text-xs font-extrabold text-slate-950 sm:text-sm">
                        Payment method
                    </h3>
                    <PaymentMethodSummary
                        className="mt-2 sm:mt-3"
                        method={order.payment.method}
                        status={paymentPresentationStatus}
                        asset={order.payment.asset}
                        network={order.payment.network}
                        receiptId={order.payment.receiptId}
                        checkoutBaseUrl={unifiWebAppBaseUrl}
                    />

                    {isPendingUniFi && order.payment.receiptId ? (
                        <div className="mt-3 sm:mt-4">
                            <UniFiReceiptStatusCard
                                receiptId={order.payment.receiptId}
                                proxyBaseUrl="/api/unifi"
                                onStatusChange={(status, receipt) =>
                                    onReceiptStatusChange(
                                        order.id,
                                        status,
                                        receipt,
                                    )
                                }
                                errorHelpText="Shipment tracking begins after UniFi reports finality."
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

export function OrdersView({
    orders,
    loading,
    error,
    onBrowse,
    unifiWebAppBaseUrl,
    onReceiptStatusChange,
}: {
    orders: BrowserOrder[];
    loading: boolean;
    error: string | null;
    onBrowse: () => void;
    unifiWebAppBaseUrl?: string;
    onReceiptStatusChange: (
        orderId: string,
        status: UniFiReceiptStatus,
        receipt: UniFiPaymentReceipt,
    ) => void;
}) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const interval = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:rounded-2xl">
                <i
                    className="bi bi-arrow-repeat inline-block animate-spin text-2xl text-slate-500"
                    aria-hidden="true"
                />
                <p className="mt-2 text-sm font-semibold text-slate-600">
                    Loading orders…
                </p>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center shadow-sm sm:rounded-2xl sm:py-16">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 sm:h-16 sm:w-16 sm:text-2xl">
                    <i className="bi bi-bag" aria-hidden="true" />
                </div>
                <h1 className="mt-4 text-lg font-extrabold text-slate-950 sm:text-2xl">
                    No orders yet
                </h1>
                <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 sm:text-sm">
                    Completed checkouts will be saved in this browser so you can
                    return and track delivery.
                </p>
                {error ? (
                    <p className="mx-auto mt-3 max-w-lg text-xs font-semibold text-red-700">
                        {error}
                    </p>
                ) : null}
                <button
                    className="mt-5 cursor-pointer rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-slate-800 active:scale-[0.99] sm:text-sm"
                    onClick={onBrowse}
                >
                    Browse products
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-3 sm:mb-5">
                <div>
                    <h1 className="text-lg font-extrabold text-slate-950 sm:text-2xl">
                        Past orders
                    </h1>
                    <p className="mt-0.5 text-[11px] text-slate-500 sm:text-sm">
                        Stored locally on this browser · {orders.length}{" "}
                        {orders.length === 1 ? "order" : "orders"}
                    </p>
                </div>
            </div>

            {error ? (
                <div
                    className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 sm:mb-5"
                    role="alert"
                >
                    {error}
                </div>
            ) : null}

            <div className="space-y-3 sm:space-y-5">
                {orders.map((order) => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        now={now}
                        unifiWebAppBaseUrl={unifiWebAppBaseUrl}
                        onReceiptStatusChange={onReceiptStatusChange}
                    />
                ))}
            </div>
        </div>
    );
}
