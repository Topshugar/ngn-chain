const express = require('express');
const cors = require('cors');
const ganache = require('ganache');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const YOUR_CHAIN_ID = 777;
const PORT = process.env.PORT || 10000;

const ganacheServer = ganache.server({
  chain: { chainId: YOUR_CHAIN_ID, networkId: YOUR_CHAIN_ID },
  wallet: {
    mnemonic: "ngn chain naira nigeria blockchain top shugar 2024 free permanent live",
    totalAccounts: 10,
    defaultBalance: 10000
  },
  logging: { quiet: true }
});

ganacheServer.listen(8545, async () => {
  console.log(`NGN Chain running Chain ID ${YOUR_CHAIN_ID}`);
  const accounts = await ganacheServer.provider.request({ method: "eth_accounts", params: [] });
  console.log("Accounts:", accounts);
});

app.get('/studio', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'studio', 'index.html'));
});

app.get('/', (req, res) => {
  res.send(`
    <h1>NGN CHAIN LIVE - Chain ID 777</h1>
    <p>RPC: https://ngn-chain.onrender.com</p>
    <p>Your Chain ID: ${YOUR_CHAIN_ID} is YOURS forever</p>
    <a href="/studio"><button style="padding:15px;background:#008751;color:white;font-size:18px;border:none;cursor:pointer">OPEN NGN STUDIO</button></a>
  `);
});

app.post('/', (req, res) => {
  ganacheServer.provider.send(req.body).then(r => res.json(r)).catch(e => res.status(500).json({error: e.message}));
});

app.listen(PORT, () => console.log(`Live on ${PORT}`));