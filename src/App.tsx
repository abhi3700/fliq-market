import { useMemo, useRef, useState } from "react";
import { products } from "./data/products";
import { PaymentMethod, type Product } from "./types";
import { formatUsd } from "./utils/money";
import unifiIcon from "./assets/unifi-icon.svg";
import usdtIcon from "./assets/usdt-icon.svg";
import usdcIcon from "./assets/usdc-icon.svg";
import daiIcon from "./assets/dai-icon.svg";
import ethereumIcon from "./assets/ethereum-icon.svg";
import polygonIcon from "./assets/polygon-icon.svg";

type Screen = "marketplace" | "payment";
type UnifiAsset = "USDT" | "USDC" | "DAI";
type UnifiNetwork = "Ethereum" | "Polygon" | "Sepolia";

function calcTax(subtotal: number): number {
  const TAX_RATE = 0.0825; // 8.25% demo
  return subtotal * TAX_RATE;
}

function FooterDivider() {
  return <span className="inline-block h-5 w-px rounded bg-black/25" />;
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
    setScreen("payment");
  }

  function backToMarketplace() {
    setScreen("marketplace");
    // keep selection? usually no; but keeping it is also fine.
    // We'll keep selected so user can go back & checkout again quickly if desired.
  }

  async function payNow() {
    if (!selected || !pricing) return;

    setIsPaying(true);
    // fake payment
    await new Promise((r) => setTimeout(r, 900));
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
                {screen === "marketplace" ? "FliQMarket" : "Checkout"}
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
              className="rounded-xl border border-slate-200 bg-white sm:px-4 px-3 py-2 sm:text-sm text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
              onClick={backToMarketplace}
            >
              ← Continue shopping
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        {screen === "marketplace" ? (
          <MarketplaceView products={filtered} onBuy={startCheckout} />
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
            onPay={payNow}
            onBack={backToMarketplace}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-5 px-4 py-6">
          <a
            href="https://linkedin.com/company/unifi-web3"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#0A66C2] hover:opacity-80"
          >
            LinkedIn
          </a>

          <FooterDivider />

          <a
            href="https://x.com/UniFi495650"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-black hover:opacity-80"
          >
            X
          </a>

          <FooterDivider />

          <a
            href="https://t.me/unifi_channel"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#229ED9] hover:opacity-80"
          >
            Telegram
          </a>

          <FooterDivider />

          <a
            href="https://www.unifiweb3.com/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#2563EB] hover:opacity-80"
          >
            Website
          </a>
        </div>
      </footer>
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
            <div className="text-sm text-slate-600">{p.description}</div>
            <div className="flex items-center justify-between">
              <div className="text-lg font-extrabold">
                {formatUsd(p.priceUsd)}
              </div>
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 active:scale-[0.99]"
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
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const disableEdits = isPaying || isSuccess;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-extrabold tracking-wide text-slate-900">
          Payment method
        </div>

        <div className="mt-4 space-y-3">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 shadow-sm transition ${
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
              <div className="text-xs text-slate-500">Pay using debit card</div>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 shadow-sm transition ${
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
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 shadow-sm transition ${
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
              <div className="text-sm font-extrabold text-slate-900">UPI</div>
              <div className="text-xs text-slate-500">Pay using UPI (demo)</div>
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
            className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
            onClick={onPay}
            disabled={isPaying}
          >
            {isPaying ? "Processing…" : `Pay ${formatUsd(pricing.total)}`}
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
            <div className="mt-3">
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
                onClick={onBack}
              >
                Back to Marketplace
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
          <div className="text-xs font-semibold text-slate-500">Quantity</div>
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
            <div className="font-semibold">{formatUsd(selected.priceUsd)}</div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-600">Qty</div>
            <div className="font-semibold">{qty}</div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-600">Subtotal</div>
            <div className="font-semibold">{formatUsd(pricing.subtotal)}</div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-600">Tax</div>
            <div className="font-semibold">{formatUsd(pricing.tax)}</div>
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

function UniFiPayOption({
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
      <span className="pt-1.5 leading-none">
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
          <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-indigo-600">
            <img src={unifiIcon} alt="UniFi" className="block h-5 w-5" />
          </span>
          <span className="text-lg font-extrabold leading-none tracking-tight text-[#321967]">
            UniFi
          </span>
        </div>

        <div className="text-xs text-slate-500">Pay with Stablecoins</div>

        {/* Asset & Network selector (shown like the mock) */}
        <div
          className={`mt-1 border-t border-black/5 pt-3 ${isActive ? "opacity-100" : "opacity-75"}`}
        >
          <div className="w-full max-w-90 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-lg">
            <div className="mb-2 w-full text-center text-xs font-extrabold text-slate-700/80">
              Asset &amp; Network
            </div>
            <div className="flex w-full flex-wrap items-center justify-center gap-3">
              <PillSelect<UnifiAsset>
                minWidth={112}
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
                minWidth={132}
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
  minWidth = 150,
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
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className={`inline-flex items-center justify-between gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-extrabold shadow-sm transition active:scale-[0.99] ${
          disabled ? "cursor-not-allowed opacity-60" : "hover:bg-slate-50"
        }`}
        style={{ background: selected.pillBg ?? "rgba(255,255,255,0.75)" }}
      >
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex h-5.5 w-5.5 flex-none items-center justify-center overflow-hidden rounded-full">
            <img
              src={selected.iconSrc}
              alt={selected.iconAlt}
              className="block h-5.5 w-5.5 rounded-full object-cover"
            />
          </span>
          <span className="text-slate-900">{selected.label}</span>
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
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-extrabold text-slate-900 hover:bg-slate-50 ${
                  active ? "bg-slate-900/5" : ""
                }
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-5.5 w-5.5 flex-none items-center justify-center overflow-hidden rounded-full">
                    <img
                      src={it.iconSrc}
                      alt={it.iconAlt}
                      className="block h-5.5 w-5.5 rounded-full object-cover"
                    />
                  </span>
                  <span>{it.label}</span>
                </span>

                {active ? <span aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
