const express = require('express');
const cors = require('cors');
const https = require('https');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

// Teller requires mutual TLS — cert & key come from env vars
const tlsAgent =
  process.env.TELLER_CERT && process.env.TELLER_PRIVATE_KEY
    ? new https.Agent({
        cert: process.env.TELLER_CERT.replace(/\\n/g, '\n'),
        key: process.env.TELLER_PRIVATE_KEY.replace(/\\n/g, '\n'),
      })
    : undefined;

const tellerGet = (path, accessToken) =>
  axios.get(`https://api.teller.io${path}`, {
    auth: { username: accessToken, password: '' },
    httpsAgent: tlsAgent,
  });

// In-memory store: { [enrollmentId]: { accessToken, institutionName } }
// For production, persist this in Railway Postgres.
const enrollments = {};

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Expose Teller application ID to the frontend ──────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({ applicationId: process.env.TELLER_APP_ID || '' });
});

// ── Store a new Teller enrollment ─────────────────────────────────────────────
app.post('/api/enroll', (req, res) => {
  const { enrollment_id, access_token, institution_name } = req.body;
  if (!enrollment_id || !access_token) {
    return res.status(400).json({ error: 'enrollment_id and access_token are required' });
  }
  enrollments[enrollment_id] = { accessToken: access_token, institutionName: institution_name };
  res.json({ enrollment_id });
});

// ── Get all linked accounts ───────────────────────────────────────────────────
app.get('/api/accounts', async (req, res) => {
  try {
    const allAccounts = [];
    for (const [enrollmentId, { accessToken, institutionName }] of Object.entries(enrollments)) {
      const { data } = await tellerGet('/accounts', accessToken);
      data.forEach(a =>
        allAccounts.push({
          account_id: a.id,
          name: a.name,
          type: a.type,
          subtype: a.subtype,
          institution_name: institutionName,
          enrollment_id: enrollmentId,
        })
      );
    }
    res.json({ accounts: allAccounts });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Get balances for all accounts ─────────────────────────────────────────────
app.get('/api/balances', async (req, res) => {
  try {
    const allBalances = [];
    for (const [enrollmentId, { accessToken, institutionName }] of Object.entries(enrollments)) {
      const { data: accounts } = await tellerGet('/accounts', accessToken);
      for (const account of accounts) {
        const { data: bal } = await tellerGet(`/accounts/${account.id}/balances`, accessToken);
        allBalances.push({
          account_id: account.id,
          name: account.name,
          type: account.type,
          subtype: account.subtype,
          institution_name: institutionName,
          enrollment_id: enrollmentId,
          balances: {
            available: bal.available != null ? parseFloat(bal.available) : null,
            current: bal.ledger != null ? parseFloat(bal.ledger) : null,
          },
        });
      }
    }
    res.json({ balances: allBalances });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Get transactions for all accounts (last 90 days) ─────────────────────────
app.get('/api/transactions', async (req, res) => {
  try {
    const allTxns = [];
    for (const [, { accessToken, institutionName }] of Object.entries(enrollments)) {
      const { data: accounts } = await tellerGet('/accounts', accessToken);
      for (const account of accounts) {
        const { data: txns } = await tellerGet(
          `/accounts/${account.id}/transactions`,
          accessToken
        );
        txns.forEach(t =>
          allTxns.push({
            transaction_id: t.id,
            account_id: account.id,
            name: t.description,
            date: t.date,
            amount: parseFloat(t.amount),
            category: t.details?.category ? [t.details.category] : [],
            institution_name: institutionName,
          })
        );
      }
    }
    allTxns.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ transactions: allTxns });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Remove a linked enrollment ────────────────────────────────────────────────
app.delete('/api/accounts/:enrollment_id', (req, res) => {
  const { enrollment_id } = req.params;
  delete enrollments[enrollment_id];
  res.json({ removed: enrollment_id });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Budget backend running on port ${PORT}`));
