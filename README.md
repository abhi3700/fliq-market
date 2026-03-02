# FliQ Market

🛒 A lightweight marketplace demo showcasing **[UniFi](https://www.unifiweb3.com/)** as a seamless payment option — alongside 💳 Debit Card, 💳 Credit Card, and 🇮🇳 UPI — within a modern payment gateway.

## Merchant

### Get your API Key

To become a merchant, sign up on the [UniFi Web App](https://unifiweb3.pages.dev/home) using the following link: \
👉 <https://unifiweb3.pages.dev/auth/signup>

You can sign up using either of the following methods:

- 📧 Email
- 🦊 Web3 Wallet (MetaMask)

Next, generate your **API Key** by following this [guide](https://github.com/abhi3700/unifi-dev-kit/blob/main/api-http/README.md).

Once your API Key is created:

- <u>Development</u>: Add the API key as an environment variable for local testing and run the app locally. ⚠️ This approach is **not secure** and should never be used in production.
![](res/merchant_opt_1.png)
- <u>Production</u>: Set up a **Frontend proxy server** to securely route UniFi API requests from your merchant site without exposing the API key. Using Cloudflare Pages Functions, both your frontend and proxy can run under the same domain — eliminating the need for a separate backend server. \
![](res/merchant_opt_2.png)

### Handle Payment Completion

After a successful payment, UniFi generates a **receipt_id** linked to the corresponding **session_id** used in the payment link.

UniFi currently does **not** persist the mapping between `session_id` and `receipt_id`. Therefore, as a merchant, you should store the generated `receipt_id` in your application database to:

- ✅ Verify successful payment completion.

    > ⚠️ Blockchain transactions require **network finality** before being considered fully confirmed.
    > For example, on Ethereum, finality typically takes ~12 minutes after the payment is submitted. This duration may vary across different blockchains.

- 📄 Maintain transaction records.
- 🔄 Reconcile orders or payment status later.

## Run

Setup needs to be done via `$ npm install`.

### Local

Both these aproaches co-exist for local development.

#### Hot reloading

> Set env var(s) in `.env.development.local` file following `.env.template`.

```sh
npm run dev
```

#### Run with proxy (function)

> Set env var(s) in `.dev.vars` file following `.env.template`.

```sh
npm run build

# Run a Cloudflare worker locally.
npx wrangler pages dev dist --port 8788
```

### Production

> [!CAUTION]
> Don't deploy by setting env var(s) in `.env.production.local` file following `.env.template`. \
> This would expose the API_KEY publicly.

---

Steps:

1. Set in “Variables and Secrets” section in your cloudflare project (Workers & Pages).
2. then

```sh
# 1. Build the project.
npm run build

# 2. Deploy the dist/ folder
# wrangler pages deploy <FOLDER_NAME> --project-name <PROJECT_NAME>
wrangler pages deploy dist --project-name fliqm
```

### 🚀 Live Demo

🛒 Experience **FliQ Market** in action:  
👉 <https://fliqm.pages.dev/>

🧪 Test payments using **Sepolia Testnet**.

⚡ Powered by UniFi Gasless Payments
