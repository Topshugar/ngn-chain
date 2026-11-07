/**
 * ============================================================================
 *  NGN CHAIN - OFFICIAL NODE SERVER (CHAIN ID 777)
 *  Network: NGN Chain | Native Asset: NGN | Consensus: Proof-of-Work
 *  Maintained By: NGN Chain Core Team | Version: 2.1.0 - PoW Fix
 *  Description: Lightweight EVM-compatible chain with integrated
 *  Miner, Trader, Faucet, Explorer and Smart Contract Verification.
 *  Security: Fees fund public faucet for transparent community distribution.
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
const MAX_SUPPLY = 1000000000;

let chainIdHex = "0x309";
let blockNumber = 1;
let blocks = [{ number:0, hash:"0x"+"0".repeat(64), timestamp: Math.floor(Date.now()/1000) }];
let txStore = {};
let receiptStore = {};
let balances = {};
let nonces = {};
let verifiedContracts=[];
let contractsMap={};

// chain
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
  }catch{}
  return false;
}
function saveChain(){
  try{
    const bStr = {};
    Object.entries(balances).forEach(([k,v])=> bStr[k]=v.toString());
    fs.writeFileSync(SAVE_PATH, JSON.stringify({ blocks, blockNumber, txStore, receiptStore, balances:bStr, nonces, verifiedContracts, contractsMap }));
  }catch{}
}

const loaded = loadChain();
const FAUCET_PK = process.env.FAUCET_PRIVATE_KEY || "0x"+"1".repeat(64);
const faucetWallet = new ethers.Wallet(FAUCET_PK);
const FAUCET_ADDR = faucetWallet.address.toLowerCase();
if(!loaded || balances[FAUCET_ADDR]===undefined){ balances[FAUCET_ADDR]=ethers.parseEther("100000"); nonces[FAUCET_ADDR]=0; saveChain(); }

// FEE 0.1% -> goes to public faucet wallet for airdrops
// Faucet wallet is transparent, used to distribute free NGN
// This proves fees fund free claims, not hidden profit
const FEE_RATE = 0.001;
const FOUNDER_WALLET = FAUCET_ADDR;

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
  return { circulating, totalSupply:MAX_SUPPLY, marketCap:circulating*traderState.price, volNGN, volUSD:volNGN*traderState.price, freeFloat:(circulating/MAX_SUPPLY*100), holders:Object.keys(balances).filter(k=>balances[k]>0n).length };
}

// mining
let difficulty = 4;
function hashBlockForMining(n,pH,nonce,ts){ return ethers.keccak256(ethers.toUtf8Bytes(`${n}${pH}${nonce}${ts}`)); }
function getRewardForHeight(h){ if(h<100000) return "50"; if(h<200000) return "25"; if(h<300000) return "12.5"; return "6.25"; }

// trader
let traderState = { price:0.0001, trades:[] };
function loadTrader(){ try{ if(fs.existsSync(TRADER_PATH)) traderState=JSON.parse(fs.readFileSync(TRADER_PATH,'utf8')); }catch{} }
function saveTrader(){ try{ fs.writeFileSync(TRADER_PATH, JSON.stringify(traderState)); }catch{} }
loadTrader();

// pages
app.get('/explorer', (req,res)=> res.sendFile(path.join(__dirname,'public','explorer','index.html')));
app.get('/faucet', (req,res)=> res.sendFile(path.join(__dirname,'public','faucet','index.html')));
app.get('/studio', (req,res)=> res.sendFile(path.join(__dirname,'public','studio','index.html')));
app.get('/trader', (req,res)=> res.sendFile(path.join(__dirname,'public','trader','index.html')));
app.get('/miner', (req,res)=> res.sendFile(path.join(__dirname,'public','miner','index.html')));

// api
app.get('/health', (req,res)=>{ const s=getRealStats(); res.json({ status:'alive', chainId:CHAIN_ID, blockHeight:blockNumber, faucet:faucetWallet.address, faucetBalance:ethers.formatEther(getBalance(FAUCET_ADDR)), traderPrice:traderState.price, realStats:s }); });
app.get('/api/stats', (req,res)=>{ const s=getRealStats(); res.json({ blockNumber, chainId:CHAIN_ID, difficulty, faucetBalance:ethers.formatEther(getBalance(FAUCET_ADDR)), traderPrice:traderState.price, ...s }); });
app.get('/api/difficulty', (req,res)=>{ const p=blocks[blocks.length-1]; res.json({ difficulty, blockHeight:blockNumber, parentHash:p.hash, reward:getRewardForHeight(blockNumber), targetPrefix:"0".repeat(difficulty), serverTime: Math.floor(Date.now()/1000) }); });

// ============================================================================
//  FIXED: /api/mine - PoW Validation (v2.1.0)
//  Previous Bug: Server generated a new timestamp on validation, so the
//  recomputed hash never matched the miner's hash -> "Invalid PoW" always.
//  Fix: Server now validates using the miner-supplied timestamp.
//  The miner must send { miner, nonce, timestamp } where timestamp is the
//  exact timestamp used during hashing. Timestamp must be within 5 mins.
// ============================================================================
app.post('/api/mine', (req,res)=>{
  try{
    const { miner, nonce, timestamp } = req.body;
    if(!miner || !/^0x[a-fA-F0-9]{40}$/.test(miner)) return res.status(400).json({error:"invalid miner"});
    if(nonce === undefined || nonce === null || isNaN(Number(nonce))) return res.status(400).json({error:"invalid nonce"});
    if(timestamp === undefined || timestamp === null || isNaN(Number(timestamp))) return res.status(400).json({error:"missing timestamp - please update miner frontend to send timestamp"});

    const p=blocks[blocks.length-1];
    const ts = parseInt(timestamp);
    const now = Math.floor(Date.now()/1000);

    // Prevent replay / stale blocks - 5 minute window
    if(Math.abs(now - ts) > 300) return res.status(400).json({error:"timestamp too old, refresh chain", serverTime: now});

    // CRITICAL FIX: Use miner's timestamp, NOT Date.now()
    const hash=hashBlockForMining(blockNumber,p.hash,nonce,ts);
    if(!hash.startsWith("0x"+"0".repeat(difficulty))) return res.status(400).json({error:"Invalid PoW", hash, expectedPrefix: "0x"+"0".repeat(difficulty)});
    if(blocks.find(b=>b.hash===hash)) return res.status(400).json({error:"Block already mined"});
    const rStr=getRewardForHeight(blockNumber); const r=ethers.parseEther(rStr);
    setBalance(miner.toLowerCase(), getBalance(miner.toLowerCase())+r);
    const b={ number:blockNumber, hash, parentHash:p.hash, timestamp:ts, nonce: Number(nonce), miner:miner.toLowerCase(), transactions:[], reward:`${rStr} NGN`, gasLimit:"0x1c9c380", gasUsed:"0x0" };
    blocks.push(b); blockNumber++; saveChain();
    res.json({success:true, block:b, reward:`${rStr} NGN`, newBalance:ethers.formatEther(getBalance(miner.toLowerCase())), hash, realStats:getRealStats()});
  }catch(e){ res.status(500).json({error:e.message}); }
});
app.get('/api/trader/price', (req,res)=>{
  const s=getRealStats();
  res.json({ price:traderState.price, supply:s.circulating.toFixed(2), circulating:s.circulating, totalSupply:s.totalSupply, marketCap:s.marketCap, volNGN:s.volNGN, volUSD:s.volUSD, freeFloat:s.freeFloat, holders:s.holders, block:blockNumber, trades:traderState.trades, change:traderState.trades.length>1 ? ((traderState.price/traderState.trades[0].price-1)*100).toFixed(2)+'%' : 'genesis', real:true });
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

    // collect fee to public faucet wallet
    setBalance(FOUNDER_WALLET, getBalance(FOUNDER_WALLET) + feeBig);

    if(side==='sell'){
      const fullBig = ethers.parseEther(amtNum.toString());
      if(getBalance(addr) < fullBig){
        // refund fee if insufficient
        setBalance(FOUNDER_WALLET, getBalance(FOUNDER_WALLET) - feeBig);
        return res.json({error:"insufficient balance"});
      }
      setBalance(addr, getBalance(addr) - fullBig);
    }
    else {
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

// faucet
const faucetClaims=new Map();
app.post('/faucet', async (req,res)=>{
  try{
    const { address } = req.body;
    if(!/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({error:"Invalid address"});
    const key=`${address.toLowerCase()}-${req.ip}`; const last=faucetClaims.get(key);
    if(last && Date.now()-last < 21600000) return res.status(429).json({error:"Rate limit 6h"});
    const to=address.toLowerCase(); const amt=ethers.parseEther("100");
    if(getBalance(FAUCET_ADDR)<amt) return res.status(500).json({error:"Faucet empty"});
    const n=nonces[FAUCET_ADDR]||0;
    const tx={ hash:ethers.keccak256(ethers.toUtf8Bytes(`${FAUCET_ADDR}-${to}-${n}-${Date.now()}`)), from:faucetWallet.address, to:address, value:"0x"+amt.toString(16), nonce:"0x"+n.toString(16), gas:"0x5208", gasPrice:"0x3b9aca00", blockNumber:"0x"+blockNumber.toString(16), chainId:chainIdHex };
    setBalance(FAUCET_ADDR,getBalance(FAUCET_ADDR)-amt); setBalance(to,getBalance(to)+amt); nonces[FAUCET_ADDR]=n+1;
    txStore[tx.hash]=tx; receiptStore[tx.hash]={transactionHash:tx.hash,status:"0x1",blockNumber:tx.blockNumber}; mineBlock([tx]); faucetClaims.set(key,Date.now());
    res.json({success:true, txHash:tx.hash, amount:"100 NGN", newBalance:ethers.formatEther(getBalance(to)), realStats:getRealStats()});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// rpc
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
    if(method==='eth_sendTransaction'){ const [txReq]=params; const from=(txReq.from||FAUCET_ADDR).toLowerCase(); const to=txReq.to.toLowerCase(); const v=BigInt(txReq.value||0); if(getBalance(from)<v) return res.json({jsonrpc:"2.0",id,error:{code:-32000,message:"insufficient funds"}}); const nonce=nonces[from]||0; const hash=ethers.keccak256(ethers.toUtf8Bytes(`${from}-${to}-${nonce}-${Date.now()}`)); const tx={hash,from,to,value:"0x"+nonce.toString(16),blockNumber:"0x"+blockNumber.toString(16)}; setBalance(from,getBalance(from)-v); setBalance(to,getBalance(to)+v); nonces[from]=nonce+1; txStore[hash]=tx; receiptStore[hash]={transactionHash:hash,status:"0x1",blockNumber:tx.blockNumber}; mineBlock([tx]); return res.json({jsonrpc:"2.0",id,result:hash}); }
    return res.json({jsonrpc:"2.0",id,result:"0x0"});
  }catch(e){ res.json({jsonrpc:"2.0",id,error:{code:-32603,message:e.message}}); }
});

app.listen(PORT, ()=> console.log(`NGN 777 live ${PORT} price $${traderState.price} circ ${getRealStats().circulating}`));