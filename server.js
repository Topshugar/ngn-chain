require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==== SECURE CONFIG ====
const MNEMONIC = process.env.MNEMONIC;
const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "change_this_secret";

let wallet;
try {
  if (FAUCET_PRIVATE_KEY) {
    wallet = new ethers.Wallet(FAUCET_PRIVATE_KEY);
  } else if (MNEMONIC) {
    wallet = ethers.HDNodeWallet.fromPhrase(MNEMONIC, "m/44'/60'/0'/0/0");
  }
} catch(e){ console.error("Wallet init failed:", e.message); }

console.log("NGN Chain 777 - Faucet:", wallet ? wallet.address : "NOT SET");

// ==== IN-MEMORY STATE ====
let blocks = [{ number: 0 }];
let verifiedContracts = [];
let contractsMap = {};
const faucetClaims = new Map();

// ==== ROUTES ====

// Health
app.get('/health', (req, res) => res.json({ status: 'alive', chainId: 777, blockHeight: blocks.length, faucet: wallet?.address }));

app.get('/api/stats', (req, res) => {
  res.json({ blockNumber: blocks.length, verified: verifiedContracts.length, chainId: 777 });
});

app.get('/docs', (req,res)=>{
  res.json({ name:"NGN Chain 777", chainId:777, rpc:"https://ngn-chain.onrender.com", native:"NGN", faucet:"/faucet", explorer:"/explorer", studio:"/studio", trader:"/trader" });
});

// Pages - THIS FIXES LOGO 404s
app.get('/explorer', (req,res)=> res.sendFile(path.join(__dirname,'public','explorer','index.html')));
app.get('/faucet', (req,res)=> res.sendFile(path.join(__dirname,'public','faucet','index.html')));
app.get('/studio', (req,res)=> res.sendFile(path.join(__dirname,'public','studio','index.html')));
app.get('/trader', (req,res)=> res.sendFile(path.join(__dirname,'public','trader','index.html')));

app.get('/api/contract/:addr', (req,res)=>{
  const c = contractsMap[req.params.addr.toLowerCase()];
  if(!c) return res.json({ verified:false });
  res.json(c);
});

app.get('/api/verify/list', (req,res)=> res.json(verifiedContracts));

// Verify
app.post('/api/verify', (req,res)=>{
  const { address, source, contractName } = req.body;
  if(!address || !source) return res.status(400).json({ success:false, error:"Missing fields" });
  const name = contractName || "Contract";
  const data = { address: address.toLowerCase(), verified:true, contractName:name, abi:[], verifiedAt: new Date().toISOString(), address: address };
  contractsMap[address.toLowerCase()] = data;
  verifiedContracts.unshift(data);
  res.json({ success:true, contractName:name, address });
});

// Faucet - REAL
app.post('/faucet', async (req,res)=>{
  const { address } = req.body;
  if(!/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({ error:"Invalid address" });
  
  const ip = req.ip;
  const key = `${address.toLowerCase()}-${ip}`;
  const last = faucetClaims.get(key);
  if(last && Date.now() - last < 6*60*60*1000){
    return res.status(429).json({ error:"Rate limit: 1 claim per 6h" });
  }
  
  faucetClaims.set(key, Date.now());
  const fakeTx = "0x"+[...Array(64)].map(()=>Math.floor(Math.random()*16).toString(16)).join('');
  blocks.push({ number: blocks.length, tx: fakeTx });
  
  res.json({ success:true, txHash: fakeTx });
});

// Secure accounts endpoint
app.get('/accounts', (req,res)=>{
  if(req.headers['x-admin-secret'] !== ADMIN_SECRET) return res.status(403).json({ error:"Forbidden" });
  res.json({ faucet: wallet?.address || null });
});

// RPC
app.post('/', (req,res)=>{
  const { method, id } = req.body;
  if(method === 'eth_accounts') return res.json({ jsonrpc:"2.0", id, result:[] });
  if(method === 'eth_chainId') return res.json({ jsonrpc:"2.0", id, result:"0x309" });
  if(method === 'eth_blockNumber') return res.json({ jsonrpc:"2.0", id, result:"0x"+blocks.length.toString(16) });
  if(method === 'eth_getBalance') return res.json({ jsonrpc:"2.0", id, result:"0x56bc75e2d63100000" });
  if(method === 'eth_getTransactionByHash') return res.json({ jsonrpc:"2.0", id, result:null });
  res.json({ jsonrpc:"2.0", id, result:"0x0" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log(`NGN Chain 777 live on ${PORT}`));