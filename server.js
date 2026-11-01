const express = require('express');
const cors = require('cors');
const ganache = require('ganache');
const path = require('path');
const solc = require('solc');

const app = express();
app.use(cors());
app.use(express.json({limit: '5mb'}));
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
ganacheServer.listen(8545, () => console.log(`Chain 777 running`));

// NEW: COMPILE ENDPOINT - This fixes phone compile
app.post('/compile', (req, res) => {
  try {
    const source = req.body.source;
    const input = {
      language: 'Solidity',
      sources: { 'NGN.sol': { content: source } },
      settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } }
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    res.json(output);
  } catch(e){ res.status(500).json({error: e.message}) }
});

app.get('/studio', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'studio', 'index.html'));
});

app.get('/', (req, res) => {
  res.send(`<h1>NGN CHAIN 777 LIVE</h1><a href="/studio">OPEN STUDIO</a>`);
});

app.post('/', (req, res) => {
  ganacheServer.provider.send(req.body).then(r => res.json(r)).catch(e => res.status(500).json({error: e.message}));
});

app.listen(PORT, () => console.log(`Live on ${PORT}`));