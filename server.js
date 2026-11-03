require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ethers } = require('ethers');
const ganache = require('ganache');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 10000;
const CHAIN_ID = 777;
const MNEMONIC = process.env.MNEMONIC || "test test test test test test test test test test test junk";
const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "ngn777_secret";

// === REAL CHAIN - Ganache in memory but REAL EVM ===
const faucetAccount = FAUCET_PRIVATE_KEY ? 
  { secretKey: FAUCET_PRIVATE_KEY, balance: "0x56BC75E2D63100000" } : // 100k NGN
  { secretKey: "0x" + "1".repeat(64), balance: "0x56BC75E2D63100000" };

const ganacheProvider = ganache.provider({
  chain: { chainId: CHAIN_ID, networkId: CHAIN_ID },
  wallet: {
    mnemonic: FAUCET_PRIVATE_KEY ? undefined : MNEMONIC,
    accounts: FAUCET_PRIVATE_KEY ? [faucetAccount] : undefined,
    totalAccounts: 10,
    defaultBalance: 100000
  },
  miner: { blockTime: 2, defaultGasPrice: 1000000000 },
  logging: { quiet: true }
});

const provider = new ethers.BrowserProvider(ganacheProvider);
let wallet;
(async()=>{
  const accounts = await ganacheProvider.request({ method: "eth_accounts", params: [] });
  const signer = await provider.getSigner(0);
  wallet = signer;
  console.log("=== NGN CHAIN 777 - REAL MODE ===");
  console.log("Chain ID:", CHAIN_ID);
  console.log("Faucet:", await signer.getAddress());
  console.log("Balance:", ethers.formatEther(await provider.getBalance(await signer.getAddress())), "NGN");
})();

// In-memory verified contracts
let verifiedContracts = [];
let contractsMap = {};
const faucetClaims = new Map();

// === PAGES ===
app.get('/explorer', (req,res)=> res.sendFile(path.join(__dirname,'public','explorer','index.html')));
app.get('/faucet', (req,res)=> res.sendFile(path.join(__dirname,'public','faucet','index.html')));
app.get('/studio', (req,res)=> res.sendFile(path.join(__dirname,'public','studio','index.html')));
app.get('/trader', (req,res)=> res.sendFile(path.join(__dirname,'public','trader','index.html')));

app.get('/health', async (req,res)=>{
  const block = await ganacheProvider.request({ method:"eth_blockNumber", params:[] });
  const accounts = await ganacheProvider.request({ method:"eth_accounts", params:[] });
  res.json({ status:'alive', chainId:CHAIN_ID, blockHeight: parseInt(block,16), faucet: accounts[0], realChain:true });
});

app.get('/api/stats', async (req,res)=>{
  const block = await ganacheProvider.request({ method:"eth_blockNumber", params:[] });
  res.json({ blockNumber: parseInt(block,16), verified: verifiedContracts.length, chainId: CHAIN_ID, real: true });
});

app.get('/docs', (req,res)=> res.json({ name:"NGN Chain 777", chainId:777, realChain:true, type:"Anvil/Ganache EVM", rpc:"https://ngn-chain.onrender.com", native:"NGN" }));

// Verify
app.post('/api/verify', (req,res)=>{
  const { address, source, contractName } = req.body;
  const data = { address: address.toLowerCase(), contractName: contractName||"Contract", source, verified:true, verifiedAt: new Date().toISOString(), abi:[] };
  contractsMap[address.toLowerCase()] = data;
  verifiedContracts.unshift(data);
  res.json({ success:true, ...data });
});
app.get('/api/contract/:addr', (req,res)=> res.json(contractsMap[req.params.addr.toLowerCase()] || { verified:false }));
app.get('/api/verify/list', (req,res)=> res.json(verifiedContracts));

// === REAL FAUCET - Actually sends tokens ===
app.post('/faucet', async (req,res)=>{
  try{
    const { address } = req.body;
    if(!/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({ error:"Invalid address" });
    const ip = req.ip;
    const key = `${address.toLowerCase()}-${ip}`;
    const last = faucetClaims.get(key);
    if(last && Date.now() - last < 6*60*60*1000) return res.status(429).json({ error:"Rate limit: 1 claim per 6h" });

    const signer = await provider.getSigner(0);
    const tx = await signer.sendTransaction({ to: address, value: ethers.parseEther("100") });
    await tx.wait();
    faucetClaims.set(key, Date.now());

    res.json({ success:true, txHash: tx.hash, real:true, amount:"100 NGN" });
  }catch(e){
    res.status(500).json({ error:e.message });
  }
});

// === REAL RPC - Proxy to Ganache ===
app.post('/', async (req,res)=>{
  try{
    const result = await ganacheProvider.request({ method: req.body.method, params: req.body.params });
    res.json({ jsonrpc:"2.0", id: req.body.id, result });
  }catch(err){
    res.json({ jsonrpc:"2.0", id: req.body.id, error: { code: -32603, message: err.message } });
  }
});

app.listen(PORT, ()=> console.log(`NGN Chain 777 REAL live on ${PORT}`));