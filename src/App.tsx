import { useMemo, useState } from "react";
import { products } from "./data/products";
import { PaymentMethod, type Product } from "./types";
import { formatUsd } from "./utils/money";
import unifiIcon from "./assets/unifi-icon.svg";

type Screen = "marketplace" | "payment";

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
}: {
  method: PaymentMethod;
  setMethod: (m: PaymentMethod) => void;
  disableEdits: boolean;
}) {
  return (
    <label
      className={`radio ${method === PaymentMethod.Unifi ? "active" : ""}`}
    >
      <input
        type="radio"
        name="payment"
        checked={method === PaymentMethod.Unifi}
        onChange={() => setMethod(PaymentMethod.Unifi)}
        disabled={disableEdits}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          className="radioTitle"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              width: 17,
              height: 17,
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
              width={17}
              height={17}
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
      </div>
    </label>
  );
}
