import type { UniFiAsset, UniFiNetwork } from "unifi-pay-widget";
import {
    UniFiPaymentPair,
    UniFiReceiptLink,
} from "unifi-pay-widget/react";
import { PaymentMethod, type PaymentMethod as PaymentMethodType } from "../types";

export type PaymentPresentationStatus = "submitted" | "paid" | "attempted";

function paymentMethodLabel(method: PaymentMethodType): string {
    if (method === PaymentMethod.Debit) return "Debit Card";
    if (method === PaymentMethod.Credit) return "Credit Card";
    if (method === PaymentMethod.Upi) return "UPI";
    return "UniFi";
}

export function PaymentMethodSummary({
    method,
    status,
    asset,
    network,
    receiptId,
    checkoutBaseUrl,
    className = "",
}: {
    method: PaymentMethodType;
    status: PaymentPresentationStatus;
    asset?: UniFiAsset | null;
    network?: UniFiNetwork | null;
    receiptId?: string | null;
    checkoutBaseUrl?: string;
    className?: string;
}) {
    const isUniFiPayment = method === PaymentMethod.Unifi;
    const verb =
        status === "attempted"
            ? "Attempted with"
            : status === "submitted"
              ? "Submitted with"
              : "Paid with";
    const unifiSelection =
        isUniFiPayment && asset && network ? { asset, network } : null;

    return (
        <div
            className={`flex items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50/70 p-2.5 sm:gap-6 sm:rounded-2xl sm:p-4 ${className}`}
            aria-label={`Payment method: ${paymentMethodLabel(method)}`}
        >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
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
                        />
                    </div>
                )}
                <div className="flex min-w-0 flex-col items-start">
                    <div className="text-xs font-extrabold leading-tight text-slate-950 sm:text-base">
                        {verb} {paymentMethodLabel(method)}
                    </div>
                    {isUniFiPayment && receiptId ? (
                        <UniFiReceiptLink
                            receiptId={receiptId}
                            checkoutBaseUrl={checkoutBaseUrl}
                            className="mt-0.5! inline-flex! items-center! gap-1! text-[10px]! leading-none! font-bold! text-indigo-700! no-underline! hover:text-indigo-800! hover:underline! sm:text-xs!"
                        >
                            Receipt
                        </UniFiReceiptLink>
                    ) : !unifiSelection ? (
                        <div className="mt-0.5 text-[11px] text-slate-500 sm:text-sm">
                            {isUniFiPayment
                                ? "Stablecoin payment"
                                : "Demo payment"}
                        </div>
                    ) : null}
                </div>
            </div>
            {unifiSelection ? (
                <UniFiPaymentPair
                    selection={unifiSelection}
                    className="ml-auto flex-none"
                />
            ) : null}
        </div>
    );
}
