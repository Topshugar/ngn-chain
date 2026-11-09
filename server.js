/**
 * ============================================================================
 *  NGN CHAIN - OFFICIAL NODE SERVER (CHAIN ID 777)
 *  Network: NGN Chain | Native Asset: NGN | Consensus: Proof-of-Work
 *  Maintained By: NGN Chain Core Team | Version: 3.0.0 - Accurate & Professional
 *
 *  OFFICIAL TOKENOMICS (Locked - Do Not Change Without Announcement):
 *  - Token: NGN Chain (NGN) | Decimals: 18
 *  - Chain ID: 777 | Consensus: PoW | Block Reward: 50 NGN (halving)
 *  - Max Supply: 10,000,000,000 NGN (10 Billion)
 *  - Faucet: 100 NGN / 6h per address+IP (onboarding only)
 *  - Price: Free Float - Market Decides. No peg. No guarantee.
 *  - Fee: 0.1% on Trader -> goes to public Faucet wallet for distribution
 *
 *  DISCLAIMER: NGN is a decentralized digital asset. Not legal tender.
 *  Not a stablecoin. Not an investment product. Price is volatile.
 *  Copyright (c) 2026 NGN Chain. All Rights Reserved.
 * ============================================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 10000;
const CHAIN_ID = 777;
const SAVE_PATH = path.join(__dirname, 'chain.json');
const TRADER_PATH = path.join(__dirname, 'trader.json');

// --- OFFICIAL CONSTANTS - ACCURATE ---
const MAX_SUPPLY = 10000000000; // 10 Billion NGN
const DECIMALS = 18;
const FAUCET_AMOUNT = "100"; // 100 NGN per claim
const FAUCET_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const FEE_RATE = 0.001; // 0.1% Trader fee -> Faucet wallet

let chainIdHex = "0x309"; // 777
let blockNumber = 1;
let blocks = [{ number:0, hash:"0x"+"0".repeat(64), timestamp: Math.floor(Date.now()/1000) }];
let txStore = {};
let receiptStore = {};
let balances = {};
let nonces = {};
let verifiedContracts=[];
let contractsMap={};

// chain persistence
function loadChain(){
  try{
    if(fs.existsSync(SAVE_PATH)){
      const d = JSON.parse(fs.readFileSync(SAVE_PATH,'utf8'));
      blocks = d.blocks || blocks;
      blockNumber = d.blockNumber || blocks.length;
      txStore = d.txStore || {};
      receiptStore = d.receiptStore || {};
      balances = {};
      Object.entries(d.balances || {}).forEach(([k,v])=>{ try{ balances[k]=BigInt(v);}catch{ balances[k]=0n; }});
      nonces = d.nonces || {};
      verifiedContracts = d.verifiedContracts || [];
      contractsMap = d.contractsMap || {};
      return true;
    }
  }catch(e){ console.error("loadChain error", e.message); }
  return false;
}
function saveChain(){
  try{
    const bStr = {};
    Object.entries(balances).forEach(([k,v])=> bStr[k]=v.toString());
    fs.writeFileSync(SAVE_PATH, JSON.stringify({ blocks, blockNumber, txStore, receiptStore, balances:bStr, nonces, verifiedContracts, contractsMap }));
  }catch(e){ console.error("saveChain error", e.message); }
}

const loaded = loadChain();

// --- FAUCET WALLET ---
// MUST be set in Render Environment Variables: FAUCET_PRIVATE_KEY
// Never commit a real private key to code. If missing, server uses a
// deterministic fallback ONLY for local dev and logs a warning.
const FAUCET_PK = process.env.FAUCET_PRIVATE_KEY;
if(!FAUCET_PK){
  console.warn("⚠️ WARNING: FAUCET_PRIVATE_KEY not set. Using dev fallback. Set it in Render > Environment.");
}
const faucetWallet = new ethers.Wallet(FAUCET_PK || "0x"+"1".repeat(64));
const FAUCET_ADDR = faucetWallet.address.toLowerCase();
if(!loaded || balances[FAUCET_ADDR]===undefined){
  // Faucet reserve: 100 Million NGN for onboarding (1% of max supply)
  // Rest of supply is mined via PoW. This is transparent on Explorer.
  balances[FAUCET_ADDR]=ethers.parseEther("100000000");
  nonces[FAUCET_ADDR]=0;
  saveChain();
}
const FOUNDER_WALLET = FAUCET_ADDR; // Fees go to same transparent faucet wallet

// utils
function getBalance(a){ return balances[a.toLowerCase()] || 0n; }
function setBalance(a,v){ balances[a.toLowerCase()]=v; }
function mineBlock(txs){
  const p = blocks[blocks.length-1];
  const nb = { number:blockNumber, hash:ethers.keccak256(ethers.toUtf8Bytes(`block-${blockNumber}-${Date.now()}`)), parentHash:p.hash, timestamp:Math.floor(Date.now()/1000), transactions:txs.map(t=>t.hash), gasLimit:"0x1c9c380", gasUsed:"0x5208" };
  blocks.push(nb); blockNumber++; saveChain(); return nb;
}
function getRealStats(){
  const totalWei = Object.values(balances).reduce((a,b)=>a+b,0n);
  const circulating = parseFloat(ethers.formatEther(totalWei));
  const trades24 = traderState.trades.filter(t=>t.time > Date.now()-86400000);
  const volNGN = trades24.reduce((a,t)=>a+t.amount,0);
  return {
    circulating,
    totalSupply: MAX_SUPPLY,
    maxSupply: MAX_SUPPLY,
    decimals: DECIMALS,
    marketCap: circulating*traderState.price,
    volNGN,
    volUSD: volNGN*traderState.price,
    freeFloat: MAX_SUPPLY>0 ? (circulating/MAX_SUPPLY*100) : 0,
    holders: Object.keys(balances).filter(k=>balances[k]>0n).length,
    faucetBalance: parseFloat(ethers.formatEther(getBalance(FAUCET_ADDR))),
    faucetAddress: FAUCET_ADDR
  };
}

// mining
let difficulty = 4;
function hashBlockForMining(n,pH,nonce,ts){ return ethers.keccak256(ethers.toUtf8Bytes(`${n}${pH}${nonce}${ts}`)); }
// Halving schedule - Transparent, matches Whitepaper
function getRewardForHeight(h){
  if(h<100000) return "50";
  if(h<200000) return "25";
  if(h<300000) return "12.5";
  return "6.25";
}

// trader
let traderState = { price:0.0001, trades:[] };
function loadTrader(){ try{ if(fs.existsSync(TRADER_PATH)) traderState=JSON.parse(fs.readFileSync(TRADER_PATH,'utf8')); }catch{} }
function saveTrader(){ try{ fs.writeFileSync(TRADER_PATH, JSON.stringify(traderState)); }catch{} }
loadTrader();

// pages - All ecosystem pages have explicit routes (no download bug)
app.get('/explorer', (req,res)=> res.sendFile(path.join(__dirname,'public','explorer','index.html')));
app.get('/faucet', (req,res)=> res.sendFile(path.join(__dirname,'public','faucet','index.html')));
app.get('/studio', (req,res)=> res.sendFile(path.join(__dirname,'public','studio','index.html')));
app.get('/trader', (req,res)=> res.sendFile(path.join(__dirname,'public','trader','index.html')));
app.get('/miner', (req,res)=> res.sendFile(path.join(__dirname,'public','miner','index.html')));
app.get('/wallet', (req,res)=> res.sendFile(path.join(__dirname,'public','wallet','index.html')));
app.get('/whitepaper', (req,res)=> res.sendFile(path.join(__dirname,'public','whitepaper','index.html')));
app.get('/whitepaper/', (req,res)=> res.sendFile(path.join(__dirname,'public','whitepaper','index.html')));
app.get('/blog', (req,res)=> res.sendFile(path.join(__dirname,'public','blog','index.html')));
app.get('/blog/', (req,res)=> res.sendFile(path.join(__dirname,'public','blog','index.html')));
app.get('/blog/what-is-decentralized-digital-asset', (req,res)=> res.sendFile(path.join(__dirname,'public','blog','what-is-decentralized-digital-asset','index.html')));
app.get('/blog/what-is-decentralized-digital-asset/', (req,res)=> res.sendFile(path.join(__dirname,'public','blog','what-is-decentralized-digital-asset','index.html')));

// api
app.get('/health', (req,res)=>{ const s=getRealStats(); res.json({ status:'alive', chainId:CHAIN_ID, blockHeight:blockNumber, faucet:faucetWallet.address, faucetBalance:ethers.formatEther(getBalance(FAUCET_ADDR)), traderPrice:traderState.price, maxSupply:MAX_SUPPLY, realStats:s }); });
app.get('/api/stats', (req,res)=>{ const s=getRealStats(); res.json({ blockNumber, chainId:CHAIN_ID, difficulty, faucetBalance:ethers.formatEther(getBalance(FAUCET_ADDR)), traderPrice:traderState.price, reward:getRewardForHeight(blockNumber), ...s }); });
app.get('/api/difficulty', (req,res)=>{ const p=blocks[blocks.length-1]; res.json({ difficulty, blockHeight:blockNumber, parentHash:p.hash, reward:getRewardForHeight(blockNumber), targetPrefix:"0".repeat(difficulty), serverTime: Math.floor(Date.now()/1000) }); });

// /api/mine - PoW Validation (v3.0)
app.post('/api/mine', (req,res)=>{
  try{
    const { miner, nonce, timestamp } = req.body;
    if(!miner || !/^0x[a-fA-F0-9]{40}$/.test(miner)) return res.status(400).json({error:"invalid miner"});
    if(nonce === undefined || nonce === null || isNaN(Number(nonce))) return res.status(400).json({error:"invalid nonce"});
    if(timestamp === undefined || timestamp === null || isNaN(Number(timestamp))) return res.status(400).json({error:"missing timestamp - please update miner frontend to send timestamp"});

    const p=blocks[blocks.length-1];
    const ts = parseInt(timestamp);
    const now = Math.floor(Date.now()/1000);
    if(Math.abs(now - ts) > 300) return res.status(400).json({error:"timestamp too old, refresh chain", serverTime: now});

    const hash=hashBlockForMining(blockNumber,p.hash,nonce,ts);
    if(!hash.startsWith("0x"+"0".repeat(difficulty))) return res.status(400).json({error:"Invalid PoW", hash, expectedPrefix: "0x"+"0".repeat(difficulty)});
    if(blocks.find(b=>b.hash===hash)) return res.status(400).json({error:"Block already mined"});
    const rStr=getRewardForHeight(blockNumber); const r=ethers.parseEther(rStr);
    // Enforce max supply - never mint beyond 10B
    const totalWei = Object.values(balances).reduce((a,b)=>a+b,0n);
    if(totalWei + r > ethers.parseEther(MAX_SUPPLY.toString())){
      return res.status(400).json({error:"Max supply reached (10B NGN). No more mining rewards."});
    }
    setBalance(miner.toLowerCase(), getBalance(miner.toLowerCase())+r);
    const b={ number:blockNumber, hash, parentHash:p.hash, timestamp:ts, nonce: Number(nonce), miner:miner.toLowerCase(), transactions:[], reward:`${rStr} NGN`, gasLimit:"0x1c9c380", gasUsed:"0x0" };
    blocks.push(b); blockNumber++; saveChain();
    res.json({success:true, block:b, reward:`${rStr} NGN`, newBalance:ethers.formatEther(getBalance(miner.toLowerCase())), hash, realStats:getRealStats()});
  }catch(e){ res.status(500).json({error:e.message}); }
});
app.get('/api/trader/price', (req,res)=>{
  const s=getRealStats();
  res.json({ price:traderState.price, supply:s.circulating.toFixed(2), circulating:s.circulating, totalSupply:s.totalSupply, maxSupply:MAX_SUPPLY, marketCap:s.marketCap, volNGN:s.volNGN, volUSD:s.volUSD, freeFloat:s.freeFloat, holders:s.holders, block:blockNumber, trades:traderState.trades, change:traderState.trades.length>1 ? ((traderState.price/traderState.trades[0].price-1)*100).toFixed(2)+'%' : 'genesis', real:true, priceModel:"Free Float - Market Decides" });
});
app.post('/api/trader/trade', (req,res)=>{
  try{
    const { wallet, amount, side } = req.body;
    if(!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return res.json({error:"invalid wallet"});
    const addr=wallet.toLowerCase();
    const amtNum = parseFloat(amount);
    if(!amtNum || amtNum <= 0) return res.json({error:"invalid amount"});
    const fee = amtNum * FEE_RATE;
    const netAmt = amtNum - fee;
    const amtBig = ethers.parseEther(netAmt.toString());
    const feeBig = ethers.parseEther(fee.toString());

    setBalance(FOUNDER_WALLET, getBalance(FOUNDER_WALLET) + feeBig);

    if(side==='sell'){
      const fullBig = ethers.parseEther(amtNum.toString());
      if(getBalance(addr) < fullBig){
        setBalance(FOUNDER_WALLET, getBalance(FOUNDER_WALLET) - feeBig);
        return res.json({error:"insufficient balance"});
      }
      setBalance(addr, getBalance(addr) - fullBig);
    }
    else {
      // Buy: check max supply before minting via trade
      const totalWei = Object.values(balances).reduce((a,b)=>a+b,0n);
      if(totalWei + amtBig > ethers.parseEther(MAX_SUPPLY.toString())){
        setBalance(FOUNDER_WALLET, getBalance(FOUNDER_WALLET) - feeBig);
        return res.json({error:"Max supply reached"});
      }
      setBalance(addr, getBalance(addr) + amtBig);
      const n=nonces[FAUCET_ADDR]||0;
      const h=ethers.keccak256(ethers.toUtf8Bytes(`${FAUCET_ADDR}-${addr}-${n}-${Date.now()}-trade`));
      const tx={hash:h,from:FAUCET_ADDR,to:addr,value:"0x"+amtBig.toString(16),nonce:"0x"+n.toString(16),blockNumber:"0x"+blockNumber.toString(16),chainId:chainIdHex};
      txStore[h]=tx; receiptStore[h]={transactionHash:h,status:"0x1",blockNumber:tx.blockNumber}; mineBlock([tx]); nonces[FAUCET_ADDR]=n+1;
    }
    const impact=(amtNum/100)*0.001;
    if(side==='buy') traderState.price*= (1+impact); else traderState.price=Math.max(0.00001,traderState.price*(1-impact));
    traderState.trades.push({ wallet:addr, amount:amtNum, netAmount:netAmt, fee:fee, side, price:traderState.price, time:Date.now() });
    if(traderState.trades.length>500) traderState.trades.shift();
    saveTrader(); saveChain();
    res.json({success:true, newPrice:traderState.price, newBalance:ethers.formatEther(getBalance(addr)), fee: fee + " NGN to faucet", realStats:getRealStats()});
  }catch(e){ res.json({error:e.message}); }
});
app.get('/api/wallets', (req,res)=>{
  const list=Object.entries(balances).map(([a,b])=>({address:a,balance:ethers.formatEther(b),nonce:nonces[a]||0})).sort((a,b)=>parseFloat(b.balance)-parseFloat(a.balance));
  res.json({ totalWallets:list.length, wallets:list.slice(0,100), realStats:getRealStats() });
});
app.post('/api/verify', (req,res)=>{ const {address,contractName,source}=req.body; const d={address:address.toLowerCase(),contractName:contractName||"Contract",source,verified:true,verifiedAt:new Date().toISOString()}; contractsMap[address.toLowerCase()]=d; verifiedContracts.unshift(d); saveChain(); res.json({success:true,...d}); });
app.get('/api/contract/:addr', (req,res)=> res.json(contractsMap[req.params.addr.toLowerCase()]||{verified:false}));
app.get('/api/verify/list', (req,res)=> res.json(verifiedContracts));

// faucet - 100 NGN / 6h
const faucetClaims=new Map();
app.post('/faucet', async (req,res)=>{
  try{
    const { address } = req.body;
    if(!/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({error:"Invalid address"});
    const key=`${address.toLowerCase()}-${req.ip}`; const last=faucetClaims.get(key);
    if(last && Date.now()-last < FAUCET_COOLDOWN_MS) return res.status(429).json({error:"Rate limit: 1 claim per 6 hours. Faucet is for onboarding only."});
    const to=address.toLowerCase(); const amt=ethers.parseEther(FAUCET_AMOUNT);
    if(getBalance(FAUCET_ADDR)<amt) return res.status(500).json({error:"Faucet empty - please try later"});
    const n=nonces[FAUCET_ADDR]||0;
    const tx={ hash:ethers.keccak256(ethers.toUtf8Bytes(`${FAUCET_ADDR}-${to}-${n}-${Date.now()}`)), from:faucetWallet.address, to:address, value:"0x"+amt.toString(16), nonce:"0x"+n.toString(16), gas:"0x5208", gasPrice:"0x3b9aca00", blockNumber:"0x"+blockNumber.toString(16), chainId:chainIdHex };
    setBalance(FAUCET_ADDR,getBalance(FAUCET_ADDR)-amt); setBalance(to,getBalance(to)+amt); nonces[FAUCET_ADDR]=n+1;
    txStore[tx.hash]=tx; receiptStore[tx.hash]={transactionHash:tx.hash,status:"0x1",blockNumber:tx.blockNumber}; mineBlock([tx]); faucetClaims.set(key,Date.now());
    res.json({success:true, txHash:tx.hash, amount:FAUCET_AMOUNT+" NGN", newBalance:ethers.formatEther(getBalance(to)), realStats:getRealStats()});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// rpc - EVM compatible
app.post('/', (req,res)=>{
  const { method, params, id } = req.body;
  try{
    if(method==='eth_chainId') return res.json({jsonrpc:"2.0",id,result:chainIdHex});
    if(method==='eth_blockNumber') return res.json({jsonrpc:"2.0",id,result:"0x"+blockNumber.toString(16)});
    if(method==='eth_accounts') return res.json({jsonrpc:"2.0",id,result:[]});
    if(method==='eth_getBalance'){ const b=getBalance(params[0]); return res.json({jsonrpc:"2.0",id,result:"0x"+b.toString(16)}); }
    if(method==='eth_getTransactionCount'){ const n=nonces[params[0].toLowerCase()]||0; return res.json({jsonrpc:"2.0",id,result:"0x"+n.toString(16)}); }
    if(method==='eth_getTransactionByHash') return res.json({jsonrpc:"2.0",id,result:txStore[params[0]]||null});
    if(method==='eth_getTransactionReceipt') return res.json({jsonrpc:"2.0",id,result:receiptStore[params[0]]||null});
    if(method==='eth_getBlockByNumber'){ const num=params[0]==='latest'?blocks.length-1:parseInt(params[0],16); const b=blocks[num]; if(!b) return res.json({jsonrpc:"2.0",id,result:null}); return res.json({jsonrpc:"2.0",id,result:{...b,number:"0x"+b.number.toString(16),timestamp:"0x"+b.timestamp.toString(16)}}); }
    if(method==='eth_sendTransaction'){
      const [txReq]=params; const from=(txReq.from||FAUCET_ADDR).toLowerCase(); const to=txReq.to.toLowerCase(); const v=BigInt(txReq.value||0);
      if(getBalance(from)<v) return res.json({jsonrpc:"2.0",id,error:{code:-32000,message:"insufficient funds"}});
      const nonce=nonces[from]||0; const hash=ethers.keccak256(ethers.toUtf8Bytes(`${from}-${to}-${nonce}-${Date.now()}`));
      // FIXED v3.0: value was previously nonce (bug). Now correct value.
      const tx={hash,from,to,value:"0x"+v.toString(16),nonce:"0x"+nonce.toString(16),blockNumber:"0x"+blockNumber.toString(16),chainId:chainIdHex};
      setBalance(from,getBalance(from)-v); setBalance(to,getBalance(to)+v); nonces[from]=nonce+1; txStore[hash]=tx; receiptStore[hash]={transactionHash:hash,status:"0x1",blockNumber:tx.blockNumber}; mineBlock([tx]); return res.json({jsonrpc:"2.0",id,result:hash});
    }
    return res.json({jsonrpc:"2.0",id,result:"0x0"});
  }catch(e){ res.json({jsonrpc:"2.0",id,error:{code:-32603,message:e.message}}); }
});

app.listen(PORT, ()=> console.log(`NGN 777 live ${PORT} | MaxSupply ${MAX_SUPPLY} NGN | price $${traderState.price} | circ ${getRealStats().circulating}`));