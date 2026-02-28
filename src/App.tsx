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
  return (
    <span
      style={{
        width: 0.75,
        height: 20,
        background: "rgba(0,0,0,0.25)",
        display: "inline-block",
        borderRadius: 1,
      }}
    />
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
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <div className="brandLogo">M</div>
          <div>
            <div className="brandTitle">
              {screen === "marketplace" ? "FliQMarket" : "Checkout"}
            </div>
            <div className="brandSub">
              {screen === "marketplace"
                ? "Lean marketplace demo"
                : "Pay securely (demo)"}
            </div>
          </div>
        </div>

        {screen === "marketplace" ? (
          <input
            className="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
          />
        ) : (
          <button className="btnSecondary" onClick={backToMarketplace}>
            ← Continue shopping
          </button>
        )}
      </header>

      <main className="container">
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

      <footer className="footer">
        <div
          className="footerLinks"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <a
            href="https://linkedin.com/company/unifi-web3"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#0A66C2", fontWeight: 500 }}
          >
            LinkedIn
          </a>

          <FooterDivider />

          <a
            href="https://x.com/UniFi495650"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#000000", fontWeight: 500 }}
          >
            X
          </a>

          <FooterDivider />

          <a
            href="https://t.me/unifi_channel"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#229ED9", fontWeight: 500 }}
          >
            Telegram
          </a>

          <FooterDivider />

          <a
            href="https://www.unifiweb3.com/"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#2563EB", fontWeight: 500 }}
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
    <div className="grid">
      {products.map((p) => (
        <div key={p.id} className="card">
          <img className="cardImg" src={p.imageUrl} alt={p.title} />
          <div className="cardBody">
            <div className="cardTitle">{p.title}</div>
            <div className="cardDesc">{p.description}</div>
            <div className="cardRow">
              <div className="price">{formatUsd(p.priceUsd)}</div>
              <button className="btn" onClick={() => onBuy(p)}>
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
      <div className="panel">
        <div className="panelTitle">No product selected</div>
        <div className="muted">
          Go back to the marketplace and choose a product.
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={onBack}>
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const disableEdits = isPaying || isSuccess;

  return (
    <div className="twoCol">
      <div className="panel">
        <div className="panelTitle">Payment method</div>

        <div className="radioGroup">
          <label
            className={`radio ${method === PaymentMethod.Debit ? "active" : ""}`}
          >
            <input
              type="radio"
              name="payment"
              checked={method === PaymentMethod.Debit}
              onChange={() => setMethod(PaymentMethod.Debit)}
              disabled={disableEdits}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div className="radioTitle">Debit Card</div>
              <div className="mutedSmall">Pay using debit card</div>
            </div>
          </label>

          <label
            className={`radio ${method === PaymentMethod.Credit ? "active" : ""}`}
          >
            <input
              type="radio"
              name="payment"
              checked={method === PaymentMethod.Credit}
              onChange={() => setMethod(PaymentMethod.Credit)}
              disabled={disableEdits}
            />
            <div>
              <div className="radioTitle">Credit Card</div>
              <div className="mutedSmall">Pay using credit card</div>
            </div>
          </label>

          <label
            className={`radio ${method === PaymentMethod.Upi ? "active" : ""}`}
          >
            <input
              type="radio"
              name="payment"
              checked={method === PaymentMethod.Upi}
              onChange={() => setMethod(PaymentMethod.Upi)}
              disabled={disableEdits}
            />
            <div>
              <div className="radioTitle">UPI</div>
              <div className="mutedSmall">Pay using UPI (demo)</div>
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
          <button className="btn payBtn" onClick={onPay} disabled={isPaying}>
            {isPaying ? "Processing…" : `Pay ${formatUsd(pricing.total)}`}
          </button>
        ) : (
          <div className="successCard">
            <div className="successBadge">✓ Payment successful</div>
            <div className="successTitle">Your product is on the way.</div>
            <div className="muted">
              Order confirmed for <b>{selected.title}</b>.
            </div>
            <div className="successActions">
              <button className="btnSecondaryDark" onClick={onBack}>
                Back to Marketplace
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panelTitle">Order summary</div>

        <div className="summaryItem">
          <img
            className="summaryImg"
            src={selected.imageUrl}
            alt={selected.title}
          />
          <div className="summaryInfo">
            <div className="summaryTitle">{selected.title}</div>
            <div className="mutedSmall">
              {formatUsd(selected.priceUsd)} each
            </div>
          </div>
        </div>

        <div className="qtyRow">
          <div className="mutedSmall">Quantity</div>
          <div className="qtyControls">
            <button
              className="qtyBtn"
              onClick={() => setQty(Math.max(1, qty - 1))}
              disabled={disableEdits}
            >
              −
            </button>
            <div className="qtyValue">{qty}</div>
            <button
              className="qtyBtn"
              onClick={() => setQty(qty + 1)}
              disabled={disableEdits}
            >
              +
            </button>
          </div>
        </div>

        <div className="breakdown">
          <div className="row">
            <div className="muted">Actual price</div>
            <div>{formatUsd(selected.priceUsd)}</div>
          </div>
          <div className="row">
            <div className="muted">Qty</div>
            <div>{qty}</div>
          </div>
          <div className="row">
            <div className="muted">Subtotal</div>
            <div>{formatUsd(pricing.subtotal)}</div>
          </div>
          <div className="row">
            <div className="muted">Tax</div>
            <div>{formatUsd(pricing.tax)}</div>
          </div>
          <div className="row total">
            <div>Total</div>
            <div>{formatUsd(pricing.total)}</div>
          </div>
        </div>

        <div className="mutedSmall" style={{ marginTop: 12 }}>
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
    <label className={`radio ${isActive ? "active" : ""}`}>
      <input
        type="radio"
        name="payment"
        checked={isActive}
        onChange={() => setMethod(PaymentMethod.Unifi)}
        disabled={disableEdits}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          className="radioTitle"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: "#4F46E5",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 auto",
            }}
          >
            <img
              src={unifiIcon}
              alt="UniFi"
              width={18}
              height={18}
              style={{ display: "block" }}
            />
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: 0.2,
              color: "#321967",
            }}
          >
            UniFi
          </span>
        </div>

        <div className="mutedSmall">Pay with Stablecoins</div>

        {/* Asset & Network selector (shown like the mock) */}
        <div
          style={{
            marginTop: 2,
            paddingTop: 10,
            borderTop: "1px solid rgba(0,0,0,0.06)",
            opacity: isActive ? 1 : 0.75,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(17, 24, 39, 0.12)",
              borderRadius: 16,
              padding: "14px 14px",
              boxShadow: "0 18px 40px rgba(17,24,39,0.10)",
              width: "100%",
              maxWidth: 360,
              boxSizing: "border-box",
              flex: "0 0 auto",
              alignSelf: "flex-start",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "rgba(17, 24, 39, 0.7)",
                marginBottom: 8,
                textAlign: "center",
                width: "100%",
              }}
            >
              Asset &amp; Network
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                justifyContent: "center",
                width: "100%",
              }}
            >
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
      style={{ position: "relative", display: "inline-flex" }}
      tabIndex={0}
      onBlur={(e) => {
        // Close only if focus moved outside this root
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        style={{
          border: "1px solid rgba(17, 24, 39, 0.14)",
          borderRadius: 999,
          padding: "6px 10px",
          background: selected.pillBg ?? "rgba(255,255,255,0.75)",
          boxShadow: "0 6px 18px rgba(17,24,39,0.08)",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          minWidth: Math.min(minWidth, 124),
          justifyContent: "space-between",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {/* Coin icon full circle for selected pill */}
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "transparent",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 auto",
              overflow: "hidden",
            }}
            aria-hidden="true"
          >
            <img
              src={selected.iconSrc}
              alt={selected.iconAlt}
              width={22}
              height={22}
              style={{
                display: "block",
                borderRadius: 999,
                objectFit: "cover",
              }}
            />
          </span>
          <span style={{ fontWeight: 800, color: "#0F172A" }}>
            {selected.label}
          </span>
        </span>

        <span
          aria-hidden="true"
          style={{
            color: "rgba(15, 23, 42, 0.7)",
            fontWeight: 900,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 140ms ease",
          }}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 0,
            zIndex: 20,
            width: 160,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(17, 24, 39, 0.14)",
            borderRadius: 14,
            boxShadow: "0 18px 40px rgba(17,24,39,0.18)",
            overflow: "hidden",
          }}
        >
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
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 10px",
                  border: "none",
                  background: active ? "rgba(15, 23, 42, 0.04)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Coin icon full circle for dropdown list */}
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background: "transparent",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "0 0 auto",
                      overflow: "hidden",
                    }}
                    aria-hidden="true"
                  >
                    <img
                      src={it.iconSrc}
                      alt={it.iconAlt}
                      width={22}
                      height={22}
                      style={{
                        display: "block",
                        borderRadius: 999,
                        objectFit: "cover",
                      }}
                    />
                  </span>
                  <span style={{ fontWeight: 900, color: "#0F172A" }}>
                    {it.label}
                  </span>
                </span>

                {active ? (
                  <span
                    aria-hidden="true"
                    style={{ fontWeight: 900, color: "#0F172A" }}
                  >
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
