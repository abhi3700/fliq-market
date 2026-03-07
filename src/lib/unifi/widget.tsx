import { useRef, useState } from "react";
import { PaymentMethod } from "../../types";
import { UnifiAsset, UnifiNetwork } from "./types";
import unifiIcon from "./assets/unifi-icon.svg";
import usdtIcon from "./assets/usdt-icon.svg";
import usdcIcon from "./assets/usdc-icon.svg";
import daiIcon from "./assets/dai-icon.svg";
import ethereumIcon from "./assets/ethereum-icon.svg";
import polygonIcon from "./assets/polygon-icon.svg";

export function UniFiPayOption({
    method,
    setMethod,
    disableEdits,
    asset,
    setAsset,
    network,
    setNetwork,
}: {
    method: PaymentMethod;
    setMethod: (m: PaymentMethod) => void;
    disableEdits: boolean;
    asset: UnifiAsset;
    setAsset: (a: UnifiAsset) => void;
    network: UnifiNetwork;
    setNetwork: (n: UnifiNetwork) => void;
}) {
    const isActive = method === PaymentMethod.Unifi;

    return (
        <label
            className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 shadow-sm transition ${
                isActive
                    ? "border-blue-500 ring-4 ring-blue-50"
                    : "border-slate-200 hover:bg-slate-50"
            }`}
        >
            <span className="pt-2.5 leading-none">
                <input
                    type="radio"
                    name="payment"
                    checked={isActive}
                    onChange={() => setMethod(PaymentMethod.Unifi)}
                    disabled={disableEdits}
                />
            </span>

            <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                    <UniFiIcon icon={unifiIcon} size={5} />
                    <span className="text-lg font-extrabold leading-none tracking-tight text-[#321967]">
                        UniFi
                    </span>
                </div>

                <div className="text-xs text-slate-500">
                    Pay with Stablecoins
                </div>

                {/* Asset & Network selector (shown like the mock) */}
                <div
                    className={`mt-1 border-t border-black/5 pt-3 ${isActive ? "opacity-100" : "opacity-75"}`}
                >
                    <div className="w-full max-w-90 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-xs">
                        <div className="mb-2 w-full text-center sm:text-[11px] text-[10px] font-extrabold text-slate-700/80">
                            Asset &amp; Network
                        </div>
                        <div className="flex w-full flex-wrap items-center justify-center gap-3">
                            <PillSelect<UnifiAsset>
                                value={asset}
                                onChange={(v) => {
                                    setMethod(PaymentMethod.Unifi);
                                    setAsset(v);
                                }}
                                disabled={disableEdits}
                                items={[
                                    {
                                        value: "USDT",
                                        label: "USDT",
                                        iconSrc: usdtIcon,
                                        iconAlt: "USDT",
                                        pillBg: "rgba(34,197,94,0.18)",
                                    },
                                    {
                                        value: "USDC",
                                        label: "USDC",
                                        iconSrc: usdcIcon,
                                        iconAlt: "USDC",
                                        pillBg: "rgba(37,99,235,0.14)",
                                    },
                                    {
                                        value: "DAI",
                                        label: "DAI",
                                        iconSrc: daiIcon,
                                        iconAlt: "DAI",
                                        pillBg: "rgba(245,158,11,0.16)",
                                    },
                                ]}
                            />
                            <PillSelect<UnifiNetwork>
                                value={network}
                                onChange={(v) => {
                                    setMethod(PaymentMethod.Unifi);
                                    setNetwork(v);
                                }}
                                disabled={disableEdits}
                                items={[
                                    {
                                        value: "Ethereum",
                                        label: "Ethereum",
                                        iconSrc: ethereumIcon,
                                        iconAlt: "Ethereum",
                                        pillBg: "rgba(17,24,39,0.08)",
                                    },
                                    {
                                        value: "Polygon",
                                        label: "Polygon",
                                        iconSrc: polygonIcon,
                                        iconAlt: "Polygon",
                                        pillBg: "rgba(124,58,237,0.14)",
                                    },
                                    {
                                        value: "Sepolia",
                                        label: "Sepolia",
                                        iconSrc: ethereumIcon,
                                        iconAlt: "Sepolia",
                                        pillBg: "rgba(17,24,39,0.08)",
                                    },
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </label>
    );
}

function PillSelect<T extends string>({
    value,
    onChange,
    items,
    disabled,
}: {
    value: T;
    onChange: (v: T) => void;
    disabled: boolean;
    minWidth?: number;
    items: Array<{
        value: T;
        label: string;
        iconSrc: string;
        iconAlt: string;
        pillBg?: string;
    }>;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    function close() {
        setOpen(false);
    }

    const selected = items.find((i) => i.value === value) ?? items[0];

    return (
        <div
            ref={rootRef}
            className="relative inline-flex outline-none"
            tabIndex={0}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                    close();
            }}
        >
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                disabled={disabled}
                className={`inline-flex items-center justify-between gap-2 rounded-full border border-slate-200 sm:px-2 sm:py-1 px-2 py-1 text-sm font-extrabold shadow-sm transition active:scale-[0.99] cursor-pointer ${
                    disabled
                        ? "cursor-not-allowed opacity-60"
                        : "hover:bg-slate-50"
                }`}
                style={{
                    background: selected.pillBg ?? "rgba(255,255,255,0.75)",
                }}
            >
                <span className="inline-flex items-center gap-2">
                    <span className="inline-flex sm:h-5.5 sm:w-5.5 h-4 w-4 flex-none items-center justify-center overflow-hidden rounded-full">
                        <img
                            src={selected.iconSrc}
                            alt={selected.iconAlt}
                            className="block sm:h-5 sm:w-5 h-4 w-4 rounded-full object-cover"
                        />
                    </span>
                    <span className="text-slate-900 sm:text-sm text-xs">
                        {selected.label}
                    </span>
                </span>
                <span
                    aria-hidden="true"
                    className={`font-black text-slate-700 transition-transform ${open ? "rotate-180" : ""}`}
                >
                    ▾
                </span>
            </button>

            {open ? (
                <div className="absolute left-0 top-10 z-20 w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-xl">
                    {items.map((it) => {
                        const active = it.value === value;
                        return (
                            <button
                                key={it.value}
                                type="button"
                                onClick={() => {
                                    onChange(it.value);
                                    close();
                                }}
                                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-extrabold text-slate-900 hover:bg-slate-50 cursor-pointer ${
                                    active ? "bg-slate-900/5" : ""
                                }
                }`}
                            >
                                <span className="flex items-center gap-2">
                                    <span className="inline-flex sm:h-5.5 sm:w-5.5 h-4 w-4 flex-none items-center justify-center overflow-hidden rounded-full">
                                        <img
                                            src={it.iconSrc}
                                            alt={it.iconAlt}
                                            className="block sm:h-5.5 sm:w-5.5 h-4 w-4 rounded-full object-cover"
                                        />
                                    </span>
                                    <span className="sm:text-sm text-xs">
                                        {it.label}
                                    </span>
                                </span>

                                {active ? (
                                    <span aria-hidden="true">✓</span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

/**
 * View UniFi Receipt.
 *
 * @param param0 receipt url
 * @returns None
 */
export function ViewReceipt({ receiptUrl }: { receiptUrl: string | null }) {
    if (!receiptUrl) return null;

    return (
        <div className="mt-3">
            <div className="flex items-center gap-2">
                <UniFiIcon icon={unifiIcon} size={4} />
                <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 active:scale-[0.99]"
                >
                    <span>View receipt</span>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-4 w-4"
                    >
                        <path d="M13.5 3a.75.75 0 000 1.5h4.19L9.22 12.97a.75.75 0 101.06 1.06L18.75 5.56v4.19a.75.75 0 001.5 0V3.75A.75.75 0 0019.5 3h-6z" />
                        <path d="M5.25 5.25A2.25 2.25 0 003 7.5v9A2.25 2.25 0 005.25 18.75h9A2.25 2.25 0 0016.5 16.5v-3a.75.75 0 00-1.5 0v3a.75.75 0 01-.75.75h-9a.75.75 0 01-.75-.75v-9a.75.75 0 01.75-.75h3a.75.75 0 000-1.5h-3z" />
                    </svg>
                </a>
            </div>
        </div>
    );
}

function UniFiIcon({ icon, size }: { icon: string; size: number }) {
    const sizeClass =
        {
            4: "h-4 w-4",
            5: "h-5 w-5",
            6: "h-6 w-6",
            7: "h-7 w-7",
            8: "h-8 w-8",
        }[size] ?? "h-4 w-4";

    return (
        <span
            className={`inline-flex ${sizeClass} flex-none items-center justify-center rounded-full bg-indigo-600`}
        >
            <img src={icon} alt="UniFi" className={`block ${sizeClass}`} />
        </span>
    );
}

function formatMmSs(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function payUrlPreview(urlStr: string): string {
    try {
        const u = new URL(urlStr);

        // Heuristic: session id is typically the last path segment.
        const segments = u.pathname.split("/").filter(Boolean);
        const last = segments.length ? segments[segments.length - 1] : "";

        const session =
            last.length >= 12 ? `${last.slice(0, 4)}…${last.slice(-4)}` : last;

        // Also show a path hint like "fliqpay"
        const hint = segments.length >= 1 ? segments[0] : "pay";

        return `${u.host} • ${hint} • session ${session || "—"}`;
    } catch {
        // Fallback for malformed URLs
        const s = urlStr.trim();
        if (s.length <= 26) return s;
        return `${s.slice(0, 16)}…${s.slice(-8)}`;
    }
}

export function UnifiWaitDialog({
    open,
    secondsLeft,
    statusText,
    payUrl,
    onCheckStatus,
    onClose,
}: {
    open: boolean;
    secondsLeft: number;
    statusText: string;
    payUrl?: string | null;
    onCheckStatus: () => Promise<void>;
    onClose: () => void;
}) {
    const [loadingAction, setLoadingAction] = useState<"check" | "done" | null>(
        null,
    );

    const isLoading = loadingAction !== null;

    const [copied, setCopied] = useState(false);

    async function copyPayUrl() {
        if (!payUrl) return;
        try {
            await navigator.clipboard.writeText(payUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
        } catch {
            // Fallback for older browsers
            try {
                const ta = document.createElement("textarea");
                ta.value = payUrl;
                ta.style.position = "fixed";
                ta.style.left = "-9999px";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
            } catch {
                // ignore
            }
        }
    }

    async function handleCheck() {
        if (isLoading) return;
        try {
            setLoadingAction("check");
            await onCheckStatus();
        } finally {
            setLoadingAction(null);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/40"
                onClick={onClose}
                aria-hidden="true"
            />

            <div className="relative w-[92%] max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-sm font-extrabold tracking-wide text-slate-900">
                            Waiting for payment
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                            Timer:{" "}
                            <span className="font-semibold">
                                {formatMmSs(secondsLeft)}
                            </span>
                        </div>
                    </div>

                    <button
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 cursor-pointer"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-bold text-slate-900">
                        {statusText}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                        You can keep the payment tab open, then come back here
                        to check the status.
                    </div>
                </div>

                {payUrl ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-[11px] font-extrabold tracking-wide text-slate-700">
                                Pay link
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={payUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                                >
                                    <span>Open</span>
                                    <i
                                        className="bi bi-box-arrow-up-right text-slate-500"
                                        aria-hidden="true"
                                    ></i>
                                </a>
                                <button
                                    type="button"
                                    onClick={copyPayUrl}
                                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                                >
                                    {copied ? "Copied" : "Copy"}
                                </button>
                            </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="min-w-0 truncate text-[11px] font-semibold text-slate-700">
                                {payUrlPreview(payUrl)}
                            </div>
                            <div className="flex-none text-[10px] font-bold text-slate-500">
                                (hidden)
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="mt-4 flex flex-col gap-2">
                    <button
                        className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.99] cursor-pointer"
                        onClick={handleCheck}
                        disabled={isLoading}
                    >
                        <span className="inline-flex items-center justify-center gap-2">
                            {loadingAction === "check" ? (
                                <svg
                                    className="h-4 w-4 animate-spin"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="none"
                                    />
                                    <path
                                        className="opacity-90"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
                                    />
                                </svg>
                            ) : null}
                            <span>
                                {loadingAction === "check"
                                    ? "Checking…"
                                    : "Done!"}
                            </span>
                        </span>
                    </button>

                    {/* <button
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.99] cursor-pointer"
            onClick={handleDone}
            disabled={isLoading}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {loadingAction === "done" ? (
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-90"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
                  />
                </svg>
              ) : null}
              <span>{loadingAction === "done" ? "Checking…" : "Done!"}</span>
            </span>
          </button> */}
                </div>
            </div>
        </div>
    );
}
