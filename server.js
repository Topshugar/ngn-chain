const express = require('express');
const cors = require('cors');
const path = require('path');
const { ethers } = require('ethers');
const solc = require('solc');

const app = express();
const CHAIN_ID = 777;
const PORT = process.env.PORT || 10000;
const FAUCET_AMOUNT = ethers.parseEther("100");
const GENESIS_SUPPLY = ethers.parseEther("987000000000000");
const MNEMONIC = "test test test test test test test test test test test junk";

const wallets = Array.from({ length: 10 }, (_, i) =>
  ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(MNEMONIC),
    `m/44'/60'/0'/0/${i}`
  )
);

const accounts = wallets.map(w => w.address);
const balances = {};
accounts.forEach((addr, idx) => {
  balances[addr.toLowerCase()] = idx === 0 ? GENESIS_SUPPLY : ethers.parseEther("100000");
});

let blockNumber = 355;
const txStore = {};
const verifiedContracts = {};

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'operational', chainId: CHAIN_ID, blockNumber });
});

app.get('/api/stats', (req, res) => {
  res.json({
    chainId: CHAIN_ID,
    blockNumber,
    validators: accounts.length,
    faucet: "active",
    verified: Object.keys(verifiedContracts).length
  });
});

app.post('/compile', (req, res) => {
  try {
    const { source } = req.body;
    const input = {
      language: 'Solidity',
      sources: { 'Contract.sol': { content: source } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
      }
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    if (output.errors) {
      const errors = output.errors.filter(e => e.severity === 'error');
      if (errors.length) return res.status(400).json({ error: errors[0].formattedMessage });
    }
    const file = output.contracts['Contract.sol'];
    const name = Object.keys(file)[0];
    const contract = file[name];
    res.json({ abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object, contractName: name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/verify', (req, res) => {
  try {
    const { address, source, contractName } = req.body;
    if (!address || !source) return res.status(400).json({ error: 'address and source required' });
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({ error: 'Invalid address' });
    const input = {
      language: 'Solidity',
      sources: { 'Contract.sol': { content: source } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
      }
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    if (output.errors) {
      const err = output.errors.filter(e => e.severity === 'error');
      if (err.length) return res.status(400).json({ error: err[0].formattedMessage });
    }
    const contracts = output.contracts['Contract.sol'];
    const name = contractName || Object.keys(contracts)[0];
    const compiled = contracts[name];
    if (!compiled) return res.status(400).json({ error: 'Contract not found' });
    verifiedContracts[address.toLowerCase()] = {
      address: address.toLowerCase(),
      contractName: name,
      source,
      abi: compiled.abi,
      bytecode: '0x' + compiled.evm.bytecode.object,
      verifiedAt: Date.now()
    };
    res.json({ success: true, ...verifiedContracts[address.toLowerCase()] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/contract/:address', (req, res) => {
  const c = verifiedContracts[req.params.address.toLowerCase()];
  if (!c) return res.status(404).json({ verified: false });
  res.json({ verified: true, ...c });
});

app.post('/faucet', (req, res) => {
  try {
    const { address } = req.body;
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    const to = address.toLowerCase();
    const from = accounts[0].toLowerCase();
    balances[from] -= FAUCET_AMOUNT;
    balances[to] = (balances[to] || 0n) + FAUCET_AMOUNT;
    blockNumber++;
    const hash = ethers.keccak256(ethers.toUtf8Bytes(`${Date.now()}${address}${Math.random()}`));
    txStore[hash] = { hash, from: accounts[0], to: address, value: FAUCET_AMOUNT.toString() };
    res.json({ success: true, txHash: hash, amount: '100 NGN' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/', (req, res) => {
  const { method, params, id } = req.body;
  try {
    let result;
    switch (method) {
      case 'eth_chainId':
        result = '0x' + CHAIN_ID.toString(16);
        break;
      case 'net_version':
        result = CHAIN_ID.toString();
        break;
      case 'eth_blockNumber':
        result = '0x' + blockNumber.toString(16);
        break;
      case 'eth_accounts':
        result = accounts;
        break;
      case 'eth_getBalance': {
        const bal = balances[params[0].toLowerCase()] || 0n;
        result = '0x' + bal.toString(16);
        break;
      }
      case 'eth_getCode': {
        const addr = params[0].toLowerCase();
        const verified = verifiedContracts[addr];
        result = verified ? verified.bytecode : '0x';
        break;
      }
      case 'eth_gasPrice':
        result = '0x3B9ACA00';
        break;
      case 'eth_estimateGas':
        result = '0x5208';
        break;
      case 'eth_sendTransaction': {
        const tx = params[0];
        const from = tx.from.toLowerCase();
        const to = (tx.to || '').toLowerCase();
        const value = tx.value ? BigInt(tx.value) : 0n;
        if ((balances[from] || 0n) < value) throw new Error('Insufficient funds');
        if (to) balances[to] = (balances[to] || 0n) + value;
        balances[from] -= value;
        blockNumber++;
        const hash = ethers.keccak256(ethers.toUtf8Bytes(`${Date.now()}${Math.random()}`));
        txStore[hash] = { hash, from: tx.from, to: tx.to, value: value.toString() };
        result = hash;
        break;
      }
      case 'eth_getTransactionByHash':
        result = txStore[params[0]] || null;
        break;
      case 'eth_getTransactionReceipt': {
        const tx = txStore[params[0]];
        result = tx ? { transactionHash: params[0], status: '0x1', blockNumber: '0x' + blockNumber.toString(16) } : null;
        break;
      }
      case 'eth_call':
        result = '0x';
        break;
      default:
        result = '0x0';
    }
    res.json({ jsonrpc: '2.0', id, result });
  } catch (err) {
    res.json({ jsonrpc: '2.0', id, error: { code: -32000, message: err.message } });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NGN Chain 777 active | ${PORT}`);
});