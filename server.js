const express = require('express');
const cors = require('cors');
const ganache = require('ganache');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // for studio

// ===== YOUR CHAIN - YOUR ID =====
const YOUR_CHAIN_ID = 777; // Change this to whatever you want - this is YOUR ID forever
const PORT = process.env.PORT || 10000;

const server = ganache.server({
  chain: {
    chainId: YOUR_CHAIN_ID,
    networkId: YOUR_CHAIN_ID
  },
  wallet: {
    mnemonic: "ngn chain naira nigeria blockchain top shugar 2024 free permanent live",
    totalAccounts: 10,
    defaultBalance: 10000
  },
  logging: {
    quiet: false
  }
});

server.listen(8545, async (err) => {
  if (err) throw err;
  console.log(`NGN Chain running with Chain ID: ${YOUR_CHAIN_ID}`);
  const provider = server.provider;
  const accounts = await provider.request({ method: "eth_accounts", params: [] });
  console.log("==================================================");
  console.log("NGN CHAIN LIVE - COPY THESE KEYS NOW");
  console.log("==================================================");
  accounts.forEach((acc, i) => console.log(`Account ${i}: ${acc}`));
  console.log("==================================================");
  console.log(`Chain ID: ${YOUR_CHAIN_ID}`);
});

// ===== YOUR OWN IDE - NGN STUDIO =====
app.get('/studio', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'studio', 'index.html'));
});

app.get('/', (req, res) => {
  res.send(`
    <h1>NGN CHAIN LIVE</h1>
    <p>RPC: https://ngn-chain.onrender.com</p>
    <p>Chain ID: ${YOUR_CHAIN_ID}</p>
    <p><a href="/studio"><button style="padding:15px;background:green;color:white;font-size:18px">OPEN NGN STUDIO (Your Remix)</button></a></p>
  `);
});

app.post('/', (req, res) => {
  server.provider.send(req.body).then(result => res.json(result)).catch(e => res.status(500).json({error: e.message}));
});

app.listen(PORT, () => console.log(`NGN Chain API live on ${PORT}`));