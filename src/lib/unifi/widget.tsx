import { useCallback, useEffect, useRef, useState } from "react";
import { PaymentMethod } from "../../types";
import { UnifiAsset, UnifiNetwork } from "./types";
import unifiIcon from "./assets/unifi-icon.svg";
import usdtIcon from "./assets/usdt-icon.svg";
import usdcIcon from "./assets/usdc-icon.svg";
import daiIcon from "./assets/dai-icon.svg";
import ethereumIcon from "./assets/ethereum-icon.svg";
import polygonIcon from "./assets/polygon-icon.svg";
import sepoliaIcon from "./assets/sepolia-icon.svg";

const ASSET_OPTIONS: Array<{
    value: UnifiAsset;
    icon: string;
    color: string;
}> = [
    {
        value: "USDT",
        icon: usdtIcon,
        color: "border-emerald-700 bg-emerald-600 text-white",
    },
    {
        value: "USDC",
        icon: usdcIcon,
        color: "border-blue-600 bg-blue-500 text-white",
    },
    {
        value: "DAI",
        icon: daiIcon,
        color: "border-amber-600 bg-amber-500 text-white",
    },
];

const NETWORK_OPTIONS: Array<{
    value: UnifiNetwork;
    icon: string;
}> = [
    { value: "Ethereum", icon: ethereumIcon },
    { value: "Polygon", icon: polygonIcon },
    { value: "Sepolia", icon: sepoliaIcon },
];

function assetIcon(asset: UnifiAsset): string {
    return ASSET_OPTIONS.find((option) => option.value === asset)?.icon ?? usdtIcon;
}

function networkIcon(network: UnifiNetwork): string {
    return (
        NETWORK_OPTIONS.find((option) => option.value === network)?.icon ??
        ethereumIcon
    );
}

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
    const [pairSheetOpen, setPairSheetOpen] = useState(false);
    const [draftAsset, setDraftAsset] = useState<UnifiAsset>(asset);
    const [draftNetwork, setDraftNetwork] = useState<UnifiNetwork>(network);
    const closePairSheet = useCallback(() => setPairSheetOpen(false), []);

    function openPairSheet() {
        if (disableEdits) return;
        setMethod(PaymentMethod.Unifi);
        setDraftAsset(asset);
        setDraftNetwork(network);
        setPairSheetOpen(true);
    }

    function commitPair() {
        setMethod(PaymentMethod.Unifi);
        setAsset(draftAsset);
        setNetwork(draftNetwork);
        setPairSheetOpen(false);
    }

    return (
        <>
            <div
                className={`flex items-center gap-2 rounded-xl border p-3 shadow-sm transition sm:gap-3 sm:rounded-2xl sm:p-4 ${
                    disableEdits ? "cursor-default" : "cursor-pointer"
                } ${
                    isActive
                        ? "border-blue-500 ring-2 ring-blue-50 sm:ring-4"
                        : "border-slate-200 hover:bg-slate-50"
                }`}
                onClick={() => {
                    if (!disableEdits) setMethod(PaymentMethod.Unifi);
                }}
            >
                <span className="leading-none">
                    <input
                        type="radio"
                        name="payment"
                        aria-label="Pay with UniFi"
                        checked={isActive}
                        onChange={() => setMethod(PaymentMethod.Unifi)}
                        disabled={disableEdits}
                    />
                </span>

                <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5 sm:gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <UniFiIcon icon={unifiIcon} size={5} />
                            <span className="text-base font-extrabold leading-none tracking-tight text-[#321967] sm:text-lg">
                                UniFi
                            </span>
                        </div>
                        <div className="mt-1.5 truncate text-[10px] text-slate-500 sm:mt-2 sm:text-xs">
                            Pay with Stablecoins
                        </div>
                    </div>

                    <button
                        type="button"
                        aria-label={`Change asset and network, ${asset} on ${network}`}
                        onClick={openPairSheet}
                        disabled={disableEdits}
                        className={`flex min-h-11 w-30 flex-none items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50/70 px-2 py-1 text-left shadow-sm transition hover:border-violet-400 hover:bg-violet-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 min-[360px]:w-32 sm:min-h-12 sm:w-44 sm:gap-2 sm:py-1.5 ${isActive ? "opacity-100" : "opacity-75"}`}
                    >
                        <PairIcon asset={asset} network={network} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-none">
                            <strong className="text-[13px] font-extrabold text-slate-950 sm:text-sm">
                                {asset}
                            </strong>
                            <span className="truncate text-[10px] font-bold text-violet-800 sm:text-[11px]">
                                {network}
                            </span>
                        </span>
                        <i
                            className="bi bi-chevron-down flex-none text-xs text-slate-500"
                            aria-hidden="true"
                        ></i>
                    </button>
                </div>
            </div>

            {pairSheetOpen ? (
                <PaymentPairSheet
                    asset={draftAsset}
                    network={draftNetwork}
                    setAsset={setDraftAsset}
                    setNetwork={setDraftNetwork}
                    onClose={closePairSheet}
                    onDone={commitPair}
                />
            ) : null}
        </>
    );
}

function PairIcon({
    asset,
    network,
}: {
    asset: UnifiAsset;
    network: UnifiNetwork;
}) {
    return (
        <span className="relative grid h-7 w-7 flex-none place-items-center sm:h-9 sm:w-9">
            <img
                src={assetIcon(asset)}
                alt=""
                className="h-6 w-6 rounded-full object-contain sm:h-8 sm:w-8"
            />
            <span className="absolute -right-0.5 -bottom-0.5 grid h-4 w-4 place-items-center overflow-hidden rounded-[35%] border-2 border-white bg-violet-100 shadow-sm sm:h-4.5 sm:w-4.5">
                <img
                    src={networkIcon(network)}
                    alt=""
                    className="h-3 w-3 object-contain sm:h-3.5 sm:w-3.5"
                />
            </span>
        </span>
    );
}

function PaymentPairSheet({
    asset,
    network,
    setAsset,
    setNetwork,
    onClose,
    onDone,
}: {
    asset: UnifiAsset;
    network: UnifiNetwork;
    setAsset: (asset: UnifiAsset) => void;
    setNetwork: (network: UnifiNetwork) => void;
    onClose: () => void;
    onDone: () => void;
}) {
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeButtonRef.current?.focus();

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }

        window.addEventListener("keydown", onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-80 flex items-end justify-center"
            role="presentation"
        >
            <button
                type="button"
                aria-label="Close asset and network picker"
                className="absolute inset-0 h-full w-full rounded-none border-0 bg-slate-950/60 p-0 backdrop-blur-[3px]"
                onClick={onClose}
            />

            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="unifi-pair-sheet-title"
                className="relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[24px] border border-b-0 border-violet-200 bg-white px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-left shadow-[0_-24px_70px_rgba(15,23,42,0.28)] sm:max-w-[26rem] sm:rounded-t-[26px] sm:px-5 sm:pt-3 sm:pb-5"
            >
                <div
                    className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 sm:mb-4 sm:h-1.5 sm:w-11"
                    aria-hidden="true"
                />

                <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5 sm:gap-4">
                    <div>
                        <h2
                            id="unifi-pair-sheet-title"
                            className="m-0 text-base leading-tight font-black tracking-[-0.035em] text-slate-950 sm:text-xl"
                        >
                            Select the asset &amp; network
                        </h2>
                        <p className="mt-1 mb-0 text-xs leading-relaxed text-slate-500 sm:mt-1.5 sm:text-[13px]">
                            Choose the stablecoin and network you want to use.
                        </p>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        aria-label="Close asset and network picker"
                        onClick={onClose}
                        className="grid h-8 w-8 flex-none place-items-center rounded-full border border-slate-300 bg-white p-0 text-sm text-slate-800 transition hover:border-violet-400 hover:bg-violet-50 active:scale-95 sm:h-9 sm:w-9 sm:text-base"
                    >
                        <i className="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                </div>

                <div>
                    <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
                        <h3 className="m-0 text-sm font-extrabold text-slate-950">
                            Assets
                        </h3>
                        <span className="text-xs text-slate-500 sm:text-[13px]">
                            Stablecoins
                        </span>
                    </div>
                    <div
                        className="flex flex-wrap items-center gap-2 sm:gap-2.5"
                        aria-label="Available stablecoins"
                    >
                        {ASSET_OPTIONS.map((option) => {
                            const selected = asset === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => setAsset(option.value)}
                                    className={`flex min-h-9 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-extrabold shadow-sm transition hover:-translate-y-0.5 sm:px-2.5 sm:text-[13px] ${option.color} ${
                                        selected
                                            ? "ring-2 ring-blue-600 ring-offset-2"
                                            : ""
                                    }`}
                                >
                                    <img
                                        src={option.icon}
                                        alt=""
                                        className="h-6 w-6 rounded-full object-contain"
                                    />
                                    <span>{option.value}</span>
                                    {selected ? (
                                        <i
                                            className="bi bi-check-circle-fill text-xs sm:text-[13px]"
                                            aria-hidden="true"
                                        ></i>
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="my-4 h-px bg-slate-200 sm:my-5" />

                <div>
                    <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
                        <h3 className="m-0 text-sm font-extrabold text-slate-950">
                            Networks
                        </h3>
                        <span className="text-xs text-slate-500 sm:text-[13px]">
                            Select network
                        </span>
                    </div>
                    <div
                        className="grid grid-cols-2 gap-2"
                        aria-label="Available networks"
                    >
                        {NETWORK_OPTIONS.map((option) => {
                            const selected = network === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => setNetwork(option.value)}
                                    className={`flex min-h-12 min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-extrabold text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-400 sm:min-h-13 sm:gap-2.5 sm:rounded-xl sm:px-2.5 sm:text-[13px] ${
                                        selected
                                            ? "border-2 border-blue-600 bg-blue-50 ring-1 ring-blue-200"
                                            : "border-slate-200 bg-slate-50"
                                    }`}
                                >
                                    <img
                                        src={option.icon}
                                        alt=""
                                        className="h-6 w-6 flex-none object-contain"
                                    />
                                    <span className="min-w-0 flex-1 truncate">
                                        {option.value}
                                    </span>
                                    {selected ? (
                                        <i
                                            className="bi bi-check-circle-fill flex-none text-xs text-blue-700 sm:text-sm"
                                            aria-hidden="true"
                                        ></i>
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onDone}
                    className="mt-4 min-h-11 w-full rounded-xl border border-emerald-400 bg-emerald-600 px-3 py-2.5 text-[13px] font-extrabold tracking-[0.08em] text-white shadow-[0_10px_24px_rgba(5,150,105,0.24)] transition hover:bg-emerald-700 active:scale-[0.99] sm:mt-5 sm:px-4"
                >
                    Done
                </button>
            </section>
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
            <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm hover:bg-violet-50 active:scale-[0.99]"
            >
                <UniFiIcon icon={unifiIcon} size={4} />
                <span>View receipt</span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4 text-violet-700"
                >
                    <path d="M13.5 3a.75.75 0 000 1.5h4.19L9.22 12.97a.75.75 0 101.06 1.06L18.75 5.56v4.19a.75.75 0 001.5 0V3.75A.75.75 0 0019.5 3h-6z" />
                    <path d="M5.25 5.25A2.25 2.25 0 003 7.5v9A2.25 2.25 0 005.25 18.75h9A2.25 2.25 0 0016.5 16.5v-3a.75.75 0 00-1.5 0v3a.75.75 0 01-.75.75h-9a.75.75 0 01-.75-.75v-9a.75.75 0 01.75-.75h3a.75.75 0 000-1.5h-3z" />
                </svg>
            </a>
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

    useEffect(() => {
        if (!open) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [open]);

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
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            <button
                type="button"
                aria-label="Close payment status sheet"
                className="absolute inset-0 h-full w-full rounded-none border-0 bg-slate-950/55 p-0 backdrop-blur-[2px]"
                onClick={onClose}
            />

            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="unifi-payment-status-title"
                className="relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-b-0 border-violet-200 bg-[#fcfbff] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-24px_70px_rgba(38,17,79,0.32)] sm:px-5 sm:pb-5"
            >
                <div className="-mx-4 rounded-t-[27px] border-b border-violet-100 bg-violet-50/80 px-4 pt-3 pb-4 sm:-mx-5 sm:px-5">
                    <div
                        className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-violet-300"
                        aria-hidden="true"
                    />

                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <UniFiIcon icon={unifiIcon} size={6} />
                            <div className="min-w-0">
                                <div className="text-sm font-black tracking-tight text-[#321967]">
                                    UniFi Pay
                                </div>
                                <div className="truncate text-[10px] font-semibold text-violet-700/75">
                                    Stablecoin checkout
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-bold text-[#321967] shadow-sm transition hover:border-violet-300 hover:bg-violet-50 active:scale-[0.98]"
                            onClick={onClose}
                        >
                            <i className="bi bi-x-lg" aria-hidden="true"></i>
                            <span>Close</span>
                        </button>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                            <div
                                id="unifi-payment-status-title"
                                className="text-lg font-black tracking-[-0.025em] text-slate-950"
                            >
                                Complete your payment
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                Waiting for confirmation from UniFi
                            </div>
                        </div>
                        <div className="inline-flex flex-none items-center gap-1.5 rounded-full border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-extrabold text-violet-800 shadow-sm">
                            <i className="bi bi-clock" aria-hidden="true"></i>
                            <span className="tabular-nums">
                                {formatMmSs(secondsLeft)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex gap-3 rounded-2xl border border-violet-200 bg-white p-3.5 shadow-sm">
                    <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-violet-100 text-base text-violet-700">
                        <i
                            className="bi bi-hourglass-split"
                            aria-hidden="true"
                        ></i>
                    </div>
                    <div className="min-w-0 pt-0.5">
                        <div className="text-sm font-extrabold text-slate-950">
                            {statusText}
                        </div>
                        <div className="mt-1 text-xs leading-relaxed text-slate-500">
                            Keep the UniFi payment tab open, then return here to
                            check the status.
                        </div>
                    </div>
                </div>

                {payUrl ? (
                    <div className="mt-3 rounded-2xl border border-violet-100 bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-[#321967]">
                                <i
                                    className="bi bi-link-45deg text-sm text-violet-600"
                                    aria-hidden="true"
                                ></i>
                                <span>Pay link</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={payUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex min-h-8 items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-800 transition hover:border-violet-300 hover:bg-violet-100"
                                >
                                    <span>Open</span>
                                    <i
                                        className="bi bi-box-arrow-up-right"
                                        aria-hidden="true"
                                    ></i>
                                </a>
                                <button
                                    type="button"
                                    onClick={copyPayUrl}
                                    className="inline-flex min-h-8 items-center gap-1 rounded-full border border-violet-200 bg-white px-3 py-1 text-[11px] font-bold text-violet-800 transition hover:border-violet-300 hover:bg-violet-50"
                                >
                                    <i
                                        className={`bi ${copied ? "bi-check-lg" : "bi-copy"}`}
                                        aria-hidden="true"
                                    ></i>
                                    <span>{copied ? "Copied" : "Copy"}</span>
                                </button>
                            </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5">
                            <div className="min-w-0 truncate text-[11px] font-semibold text-slate-700">
                                {payUrlPreview(payUrl)}
                            </div>
                            <div className="flex-none rounded-full bg-white px-2 py-0.5 text-[9px] font-extrabold text-violet-700 ring-1 ring-violet-100">
                                (hidden)
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="mt-4 flex flex-col gap-2">
                    <button
                        className="w-full cursor-pointer rounded-2xl bg-[#321967] px-4 py-3 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(50,25,103,0.28)] transition hover:bg-[#281252] disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.99]"
                        onClick={handleCheck}
                        disabled={isLoading}
                    >
                        <span className="inline-flex items-center justify-center gap-2">
                            {loadingAction === "check" ? (
                                <i
                                    className="bi bi-arrow-repeat animate-spin text-base"
                                    aria-hidden="true"
                                ></i>
                            ) : null}
                            <span>
                                {loadingAction === "check"
                                    ? "Checking…"
                                    : "Done"}
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
              <span>{loadingAction === "done" ? "Checking…" : "Done"}</span>
            </span>
          </button> */}
                </div>
            </section>
        </div>
    );
}
