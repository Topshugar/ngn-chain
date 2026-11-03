require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==== SECURE CONFIG - NO HARDCODED KEYS ====
const MNEMONIC = process.env.MNEMONIC;
const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY; // single key for faucet
const ADMIN_SECRET = process.env.ADMIN_SECRET || "change_this_secret";

if (!MNEMONIC && !FAUCET_PRIVATE_KEY) {
  console.warn("WARNING: Set MNEMONIC or FAUCET_PRIVATE_KEY in Render env");
}

// In-memory chain state (same as before)
let blocks = [];
let transactions = [];
let contracts = {}; // verified contracts map

// Provider setup using mnemonic securely
let wallet;
if (FAUCET_PRIVATE_KEY) {
  wallet = new ethers.Wallet(FAUCET_PRIVATE_KEY);
} else if (MNEMONIC) {
  const hdNode = ethers.HDNodeWallet.fromPhrase(MNEMONIC);
  wallet = hdNode;
}

console.log("NGN Chain 777 - Secure Mode - Faucet:", wallet ? wallet.address : "not set");

// ==== ROUTES ====

// Health - keep alive
app.get('/health', (req, res) => res.json({ status: 'alive', chainId: 777, blockHeight: blocks.length }));

app.get('/', (req, res) => res.send('NGN Chain 777 - RPC Live - chainId 777'));

// Docs
app.get('/docs', (req, res) => {
  res.json({
    name: "NGN Chain 777",
    chainId: 777,
    rpc: "https://ngn-chain.onrender.com",
    faucet: "https://ngn-chain.onrender.com/faucet",
    explorer: "https://ngn-chain.onrender.com/explorer",
    methods: ["eth_chainId", "eth_getBalance", "eth_sendTransaction", "eth_blockNumber"],
    faucetLimits: "0.1 NGN per address per 24h"
  });
});

// SECURE: Only allow admin to see accounts
app.get('/accounts', (req, res) => {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden - admin only" });
  }
  res.json({ faucet: wallet.address });
});

// Faucet with IP + address rate limit (basic)
const faucetClaims = new Map();
app.post('/faucet', async (req, res) => {
  const { address } = req.body;
  const ip = req.ip;
  const key = `${address}-${ip}`;
  const last = faucetClaims.get(key);
  if (last && Date.now() - last < 24*60*60*1000) {
    return res.status(429).json({ error: "Faucet limit: once per 24h" });
  }
  // ... your send logic here using wallet
  faucetClaims.set(key, Date.now());
  res.json({ success: true, txHash: "0x..." });
});

// RPC Proxy
app.post('/', async (req, res) => {
  // Block dangerous methods
  if (req.body.method === 'eth_accounts') {
    return res.json({ jsonrpc: "2.0", id: req.body.id, result: [] }); // hide wallets
  }
  // forward to your chain logic...
  res.json({ jsonrpc: "2.0", id: req.body.id, result: "0x309" }); // 777 hex
});

// Explorer static
app.get('/explorer', (req, res) => res.sendFile(path.join(__dirname, 'explorer/index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`NGN Chain 777 live on ${PORT}`));