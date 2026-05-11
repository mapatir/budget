# D & A Budget App

A personal budget dashboard with Plaid bank integration, biweekly paycheck tracking, and CSV import.

---

## What's in this repo

```
budget/
├── index.html        ← Frontend (hosted on GitHub Pages)
└── server/
    ├── index.js      ← Express backend (deploy to Railway)
    ├── package.json
    └── .env.example  ← Copy to .env and fill in your Plaid keys
```

---

## Step 1 — Host the frontend on GitHub Pages

1. Go to github.com and create a new repo called `budget` (public)
2. Upload `index.html` to the root of the repo
3. Go to **Settings → Pages → Source → Deploy from branch → main → / (root)**
4. Your app will be live at `https://yourusername.github.io/budget`

The app works immediately without any backend — data saves to your browser's localStorage.

---

## Step 2 — Get free Plaid API keys (for bank linking)

1. Go to [https://dashboard.plaid.com/signup](https://dashboard.plaid.com/signup)
2. Create a free account
3. Go to **Team Settings → Keys**
4. Copy your **Client ID** and **Sandbox Secret**

> Sandbox mode uses fake bank data for testing — free, no approval needed.
> To connect real banks you'll need to request "Development" access (also free, takes 1-2 days).

---

## Step 3 — Deploy the backend to Railway

Railway is a free cloud platform that runs your Node.js server.

1. Go to [https://railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your `budget` repo
4. Set the **Root Directory** to `server`
5. Add these **Environment Variables** in Railway's dashboard:
   ```
   PLAID_CLIENT_ID=your_client_id_here
   PLAID_SECRET=your_sandbox_secret_here
   PLAID_ENV=sandbox
   ```
6. Railway will give you a public URL like `https://budget-production-xxxx.up.railway.app`

---

## Step 4 — Connect frontend to backend

1. Open your app at `yourusername.github.io/budget`
2. Go to **Settings** in the sidebar
3. Paste your Railway URL into the **Backend URL** field
4. Click **Save & Test Connection** — it should show green/Online
5. Go to **Accounts** and click **Connect Account** to link your bank via Plaid

---

## Features

- **Dashboard** — Budget vs Actual panels for Bills, Savings, Income, Cash Flow
- **Paychecks** — Track biweekly paychecks for Manny and Danielle separately
- **Accounts** — Live balances for all linked banks and credit cards (via Plaid)
- **Transactions** — View recent transactions; also import CSV from any bank
- **Settings** — Configure backend URL; data stored in browser localStorage

---

## Notes

- Budget data (actuals, paychecks) saves in your **browser's localStorage** — it stays between visits on the same device
- Plaid access tokens are stored in the Railway server's memory — they reset if the server restarts. For a permanent solution, add a Railway Postgres database (also free tier available)
- To go live with real banks, change `PLAID_ENV=development` in Railway and request Development access on the Plaid dashboard
