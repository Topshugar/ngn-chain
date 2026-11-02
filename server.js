const express = require('express');
const cors = require('cors');
const ganache = require('ganache');
const path = require('path');
const solc = require('solc');

const app = express();
app.use(cors());
app.use(express.json({limit: '5mb'}));

const YOUR_CHAIN_ID = 777;
const PORT = process.env.PORT || 10000;

const ganacheServer = ganache.server({
  chain: { chainId: YOUR_CHAIN_ID, networkId: YOUR_CHAIN_ID },
  wallet: {
    mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    totalAccounts: 10,
    defaultBalance: 10000
  },
  logging: { quiet: true }
});

ganacheServer.listen(8545, () => console.log('Chain 777 running'));

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
  } catch(e){ 
    res.status(500).json({error: e.message}); 
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/studio', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'studio', 'index.html'));
});

app.post('/', (req, res) => {
  ganacheServer.provider.send(req.body).then(r => res.json(r)).catch(e => res.status(500).json({error: e.message}));
});

app.listen(PORT, () => console.log(`Live on ${PORT}`));