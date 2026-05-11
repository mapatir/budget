const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } = require('plaid');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

// In-memory store (use a DB like Railway Postgres for production)
const accessTokens = {};

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Create link token (step 1 of Plaid Link flow) ────────────────────────────
app.post('/api/create-link-token', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'budget-user-1' },
      client_name: 'D & A Budget',
      products: [Products.Transactions, Products.Auth],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ── Exchange public token for access token (step 2) ──────────────────────────
app.post('/api/exchange-token', async (req, res) => {
  const { public_token, institution_name } = req.body;
  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    accessTokens[itemId] = { accessToken, institution_name };
    res.json({ item_id: itemId, institution_name });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ── Get all linked accounts ───────────────────────────────────────────────────
app.get('/api/accounts', async (req, res) => {
  try {
    const allAccounts = [];
    for (const [itemId, { accessToken, institution_name }] of Object.entries(accessTokens)) {
      const response = await plaidClient.accountsGet({ access_token: accessToken });
      const accounts = response.data.accounts.map(a => ({
        ...a,
        item_id: itemId,
        institution_name,
      }));
      allAccounts.push(...accounts);
    }
    res.json({ accounts: allAccounts });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ── Get transactions (last 30 days) ──────────────────────────────────────────
app.get('/api/transactions', async (req, res) => {
  const endDate   = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0];
  try {
    const allTransactions = [];
    for (const [itemId, { accessToken, institution_name }] of Object.entries(accessTokens)) {
      const response = await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: { count: 250 },
      });
      const txns = response.data.transactions.map(t => ({ ...t, institution_name }));
      allTransactions.push(...txns);
    }
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ transactions: allTransactions });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ── Get balances ──────────────────────────────────────────────────────────────
app.get('/api/balances', async (req, res) => {
  try {
    const allBalances = [];
    for (const [itemId, { accessToken, institution_name }] of Object.entries(accessTokens)) {
      const response = await plaidClient.accountsBalanceGet({ access_token: accessToken });
      const accounts = response.data.accounts.map(a => ({
        account_id: a.account_id,
        name: a.name,
        official_name: a.official_name,
        type: a.type,
        subtype: a.subtype,
        balances: a.balances,
        institution_name,
      }));
      allBalances.push(...accounts);
    }
    res.json({ balances: allBalances });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ── Remove a linked institution ───────────────────────────────────────────────
app.delete('/api/accounts/:item_id', async (req, res) => {
  const { item_id } = req.params;
  try {
    if (accessTokens[item_id]) {
      await plaidClient.itemRemove({ access_token: accessTokens[item_id].accessToken });
      delete accessTokens[item_id];
    }
    res.json({ removed: item_id });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Budget backend running on port ${PORT}`));
