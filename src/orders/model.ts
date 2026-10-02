import type {
    UniFiAsset,
    UniFiNetwork,
    UniFiPaymentReceipt,
    UniFiReceiptStatus,
} from "unifi-pay-widget";
import type { PaymentMethod, Product } from "../types";

export const PREPARATION_DURATION_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type StoredPaymentStatus =
    | "processing"
    | "finalized"
    | "failed"
    | "reorged";

export type ShipmentStatus =
    | "payment_processing"
    | "payment_failed"
    | "preparing"
    | "dispatched"
    | "delivered";

export type BrowserOrder = {
    schemaVersion: 1;
    id: string;
    createdAt: string;
    paymentFinalizedAt: string | null;
    dispatchAt: string | null;
    expectedDeliveryAt: string | null;
    product: {
        id: string;
        title: string;
        imageUrl: string;
        priceUsd: number;
        estimatedDeliveryDays: number;
    };
    quantity: number;
    subtotalUsd: number;
    taxUsd: number;
    totalUsd: number;
    payment: {
        method: PaymentMethod;
        status: StoredPaymentStatus;
        receiptStatus: UniFiReceiptStatus | null;
        receiptId: string | null;
        sessionId: string | null;
        asset: UniFiAsset | null;
        network: UniFiNetwork | null;
    };
};

export type CreateBrowserOrderInput = {
    id: string;
    createdAt: Date;
    product: Product;
    quantity: number;
    pricing: { subtotal: number; tax: number; total: number };
    payment: {
        method: PaymentMethod;
        status: StoredPaymentStatus;
        receiptStatus?: UniFiReceiptStatus | null;
        receiptId?: string | null;
        sessionId?: string | null;
        asset?: UniFiAsset | null;
        network?: UniFiNetwork | null;
    };
    paymentFinalizedAt?: Date | null;
};

export type ShipmentProgress = {
    status: ShipmentStatus;
    dispatchAt: Date | null;
    expectedDeliveryAt: Date | null;
};

function deliveryDays(value: number): number {
    return Math.max(1, Math.ceil(value));
}

function fulfillmentDates(finalizedAt: Date | null, estimatedDays: number) {
    if (!finalizedAt) {
        return {
            paymentFinalizedAt: null,
            dispatchAt: null,
            expectedDeliveryAt: null,
        };
    }

    return {
        paymentFinalizedAt: finalizedAt.toISOString(),
        dispatchAt: new Date(
            finalizedAt.getTime() + PREPARATION_DURATION_MS,
        ).toISOString(),
        expectedDeliveryAt: new Date(
            finalizedAt.getTime() + deliveryDays(estimatedDays) * DAY_MS,
        ).toISOString(),
    };
}

export function createBrowserOrder(
    input: CreateBrowserOrderInput,
): BrowserOrder {
    const finalizedAt =
        input.payment.status === "finalized"
            ? (input.paymentFinalizedAt ?? input.createdAt)
            : null;
    const dates = fulfillmentDates(
        finalizedAt,
        input.product.estimatedDeliveryDays,
    );

    return {
        schemaVersion: 1,
        id: input.id,
        createdAt: input.createdAt.toISOString(),
        ...dates,
        product: {
            id: input.product.id,
            title: input.product.title,
            imageUrl: input.product.imageUrl,
            priceUsd: input.product.priceUsd,
            estimatedDeliveryDays: deliveryDays(
                input.product.estimatedDeliveryDays,
            ),
        },
        quantity: input.quantity,
        subtotalUsd: input.pricing.subtotal,
        taxUsd: input.pricing.tax,
        totalUsd: input.pricing.total,
        payment: {
            method: input.payment.method,
            status: input.payment.status,
            receiptStatus: input.payment.receiptStatus ?? null,
            receiptId: input.payment.receiptId ?? null,
            sessionId: input.payment.sessionId ?? null,
            asset: input.payment.asset ?? null,
            network: input.payment.network ?? null,
        },
    };
}

function receiptFinalizedAt(
    receipt: UniFiPaymentReceipt | undefined,
    observedAt: Date,
): Date {
    if (!receipt || !Number.isFinite(receipt.end_ts_us)) return observedAt;

    const timestampMs = receipt.end_ts_us / 1000;
    const earliestSupportedMs = Date.UTC(2020, 0, 1);
    const latestSupportedMs = observedAt.getTime() + 5 * 60 * 1000;
    if (
        timestampMs < earliestSupportedMs ||
        timestampMs > latestSupportedMs
    ) {
        return observedAt;
    }

    return new Date(timestampMs);
}

export function storedPaymentStatus(
    status: UniFiReceiptStatus,
): StoredPaymentStatus {
    if (status === "Finalized") return "finalized";
    if (status === "Failed") return "failed";
    if (status === "Reorged") return "reorged";
    return "processing";
}

export function updateOrderReceiptStatus(
    order: BrowserOrder,
    status: UniFiReceiptStatus,
    receipt: UniFiPaymentReceipt | undefined,
    observedAt = new Date(),
): BrowserOrder {
    const nextPaymentStatus = storedPaymentStatus(status);
    const finalizedAt =
        nextPaymentStatus === "finalized"
            ? order.paymentFinalizedAt
                ? new Date(order.paymentFinalizedAt)
                : receiptFinalizedAt(receipt, observedAt)
            : null;
    const dates = fulfillmentDates(
        finalizedAt,
        order.product.estimatedDeliveryDays,
    );

    return {
        ...order,
        ...dates,
        payment: {
            ...order.payment,
            status: nextPaymentStatus,
            receiptStatus: status,
            receiptId: receipt?.id ?? order.payment.receiptId,
        },
    };
}

export function getShipmentProgress(
    order: BrowserOrder,
    now = new Date(),
): ShipmentProgress {
    const dispatchAt = order.dispatchAt ? new Date(order.dispatchAt) : null;
    const expectedDeliveryAt = order.expectedDeliveryAt
        ? new Date(order.expectedDeliveryAt)
        : null;

    if (
        order.payment.status === "failed" ||
        order.payment.status === "reorged"
    ) {
        return { status: "payment_failed", dispatchAt, expectedDeliveryAt };
    }
    if (
        order.payment.status !== "finalized" ||
        !dispatchAt ||
        !expectedDeliveryAt
    ) {
        return {
            status: "payment_processing",
            dispatchAt,
            expectedDeliveryAt,
        };
    }
    if (now.getTime() < dispatchAt.getTime()) {
        return { status: "preparing", dispatchAt, expectedDeliveryAt };
    }
    if (now.getTime() < expectedDeliveryAt.getTime()) {
        return { status: "dispatched", dispatchAt, expectedDeliveryAt };
    }
    return { status: "delivered", dispatchAt, expectedDeliveryAt };
}

export function isBrowserOrder(value: unknown): value is BrowserOrder {
    if (!value || typeof value !== "object") return false;
    const order = value as Partial<BrowserOrder>;
    return (
        order.schemaVersion === 1 &&
        typeof order.id === "string" &&
        typeof order.createdAt === "string" &&
        typeof order.product?.title === "string" &&
        typeof order.product?.estimatedDeliveryDays === "number" &&
        typeof order.quantity === "number" &&
        typeof order.totalUsd === "number" &&
        typeof order.payment?.status === "string"
    );
}
