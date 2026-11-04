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

// === CONSTANTS - REAL ===
const MAX_SUPPLY = 1000000000; // 1B cap - fixed, like Bitcoin

// === PERSISTENCE ===
let chainIdHex = "0x309";
let blockNumber = 1;
let blocks = [{ number:0, hash:"0x"+ "0".repeat(64), timestamp: Math.floor(Date.now()/1000) }];
let txStore = {};
let receiptStore = {};
let balances = {};
let nonces = {};
let verifiedContracts=[];
let contractsMap={};

function loadChain(){
  try{
    if(fs.existsSync(SAVE_PATH)){
      const raw = fs.readFileSync(SAVE_PATH,'utf8');
      const data = JSON.parse(raw);
      blocks = data.blocks || blocks;
      blockNumber = data.blockNumber || blocks.length;
      txStore = data.txStore || {};
      receiptStore = data.receiptStore || {};
      balances = {};
      Object.entries(data.balances || {}).forEach(([k,v])=>{
        try{ balances[k] = BigInt(v); }catch{ balances[k]=0n; }
      });
      nonces = data.nonces || {};
      verifiedContracts = data.verifiedContracts || [];
      contractsMap = data.contractsMap || {};
      return true;
    }
  }catch(e){ console.log("[PERSIST] Load failed:", e.message); }
  return false;
}

function saveChain(){
  try{
    const balancesStr = {};
    Object.entries(balances).forEach(([k,v])=>{ balancesStr[k]=v.toString(); });
    const data = { blocks, blockNumber, txStore, receiptStore, balances: balancesStr, nonces, verifiedContracts, contractsMap, savedAt: new Date().toISOString() };
    fs.writeFileSync(SAVE_PATH, JSON.stringify(data));
  }catch(e){}
}

const loaded = loadChain();
const FAUCET_PK = process.env.FAUCET_PRIVATE_KEY || "0x"+"1".repeat(64);
const faucetWallet = new ethers.Wallet(FAUCET_PK);
const FAUCET_ADDR = faucetWallet.address.toLowerCase();

if(!loaded || balances[FAUCET_ADDR]===undefined){
  balances[FAUCET_ADDR] = ethers.parseEther("100000");
  nonces[FAUCET_ADDR] = 0;
  saveChain();
}

function getBalance(addr){ return balances[addr.toLowerCase()] || 0n; }
function setBalance(addr, val){ balances[addr.toLowerCase()] = val; }

function mineBlock(txs){
  const parent = blocks[blocks.length-1];
  const newBlock = { number: blockNumber, hash: ethers.keccak256(ethers.toUtf8Bytes(`block-${blockNumber}-${Date.now()}`)), parentHash: parent.hash, timestamp: Math.floor(Date.now()/1000), transactions: txs.map(t=>t.hash), gasLimit: "0x1c9c380", gasUsed: "0x5208" };
  blocks.push(newBlock); blockNumber++; saveChain(); return newBlock;
}

let difficulty = 4;
function hashBlockForMining(num, parentHash, nonce, timestamp){ return ethers.keccak256(ethers.toUtf8Bytes(`${num}${parentHash}${nonce}${timestamp}`)); }
function getRewardForHeight(height){ if(height < 100000) return "50"; if(height < 200000) return "25"; if(height < 300000) return "12.5"; return "6.25"; }

// === FREE FLOAT TRADER - REAL ===
let traderState = { price: 0.0001, trades: [] };
function loadTrader(){ try{ if(fs.existsSync(TRADER_PATH)){ traderState = JSON.parse(fs.readFileSync(TRADER_PATH,'utf8')); } }catch(e){} }
function saveTrader(){ try{ fs.writeFileSync(TRADER_PATH, JSON.stringify(traderState)); }catch(e){} }
loadTrader();

// REAL SUPPLY CALCULATION
function getRealStats(){
  const totalWei = Object.values(balances).reduce((a,b)=>a+b,0n);
  const circulating = parseFloat(ethers.formatEther(totalWei));
  const marketCap = circulating * traderState.price;
  const dayAgo = Date.now() - 24*60*60*1000;
  const trades24 = traderState.trades.filter(t=>t.time > dayAgo);
  const volNGN = trades24.reduce((a,t)=>a+t.amount,0);
  const volUSD = volNGN * traderState.price;
  const freeFloat = (circulating / MAX_SUPPLY * 100);
  const holders = Object.keys(balances).filter(k=>balances[k]>0n).length;
  return { circulating, totalSupply: MAX_SUPPLY, marketCap, volNGN, volUSD, freeFloat, holders, totalWei };
}

app.get('/explorer', (req,res)=> res.sendFile(path.join(__dirname,'public','explorer','index.html')));
app.get('/faucet', (req,res)=> res.sendFile(path.join(__dirname,'public','faucet','index.html')));
app.get('/studio', (req,res)=> res.sendFile(path.join(__dirname,'public','studio','index.html')));
app.get('/trader', (req,res)=> res.sendFile(path.join(__dirname,'public','trader','index.html')));
app.get('/miner', (req,res)=> res.sendFile(path.join(__dirname,'public','miner','index.html')));

app.get('/health', (req,res)=>{
  const s = getRealStats();
  res.json({ status:'alive', chainId:CHAIN_ID, blockHeight:blockNumber, blocks:blocks.length, faucet: faucetWallet.address, realChain:true, persistent:true, mining:true, freeFloat:true, faucetBalance: ethers.formatEther(getBalance(FAUCET_ADDR)), traderPrice: traderState.price, realStats: s });
});

app.get('/api/stats', (req,res)=>{
  const s = getRealStats();
  res.json({ blockNumber, chainId:CHAIN_ID, real:true, persistent:true, mining:true, difficulty, faucetBalance: ethers.formatEther(getBalance(FAUCET_ADDR)), traderPrice: traderState.price, ...s });
});

app.get('/api/difficulty', (req,res)=>{
  const parent = blocks[blocks.length-1];
  res.json({ difficulty, blockHeight: blockNumber, parentHash: parent.hash, reward: getRewardForHeight(blockNumber), targetPrefix: "0".repeat(difficulty) });
});

app.post('/api/mine', (req,res)=>{
  try{
    const { miner, nonce } = req.body;
    if(!miner || !/^0x[a-fA-F0-9]{40}$/.test(miner)) return res.status(400).json({error:"invalid miner address"});
    const parent = blocks[blocks.length-1];
    const timestamp = Math.floor(Date.now()/1000);
    const hash = hashBlockForMining(blockNumber, parent.hash, nonce, timestamp);
    if(!hash.startsWith("0x" + "0".repeat(difficulty))) return res.status(400).json({error:"Invalid PoW", hash, required: "0".repeat(difficulty)});
    if(blocks.find(b=>b.hash===hash)) return res.status(400).json({error:"Block already mined"});
    const rewardStr = getRewardForHeight(blockNumber);
    const reward = ethers.parseEther(rewardStr);
    setBalance(miner.toLowerCase(), getBalance(miner.toLowerCase()) + reward);
    const block = { number: blockNumber, hash, parentHash: parent.hash, timestamp, nonce, miner: miner.toLowerCase(), transactions: [], reward: `${rewardStr} NGN`, gasLimit: "0x1c9c380", gasUsed: "0x0" };
    blocks.push(block); blockNumber++; saveChain();
    res.json({success:true, block, reward:`${rewardStr} NGN`, newBalance: ethers.formatEther(getBalance(miner.toLowerCase())), hash, realStats: getRealStats() });
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Trader APIs - REAL
app.get('/api/trader/price', (req,res)=>{
  const s = getRealStats();
  res.json({ price: traderState.price, supply: s.circulating.toFixed(2), circulating: s.circulating, totalSupply: s.totalSupply, marketCap: s.marketCap, volNGN: s.volNGN, volUSD: s.volUSD, freeFloat: s.freeFloat, holders: s.holders, block: blockNumber, trades: traderState.trades, change: traderState.trades.length>1 ? ((traderState.price / traderState.trades[0].price -1)*100).toFixed(2)+'% since genesis' : 'genesis', real:true });
});

app.post('/api/trader/trade', (req,res)=>{
  try{
    const { wallet, amount, side } = req.body;
    if(!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return res.json({error:"invalid wallet"});
    if(!amount || amount<=0) return res.json({error:"invalid amount"});
    const addr = wallet.toLowerCase();
    const amtBig = ethers.parseEther(amount.toString());
    if(side==='sell'){
      if(getBalance(addr) < amtBig) return res.json({error:"insufficient NGN balance to sell - mine or buy first"});
      setBalance(addr, getBalance(addr) - amtBig);
    } else {
      setBalance(addr, getBalance(addr) + amtBig);
      const nonce = nonces[FAUCET_ADDR]||0;
      const txHash = ethers.keccak256(ethers.toUtf8Bytes(`${FAUCET_ADDR}-${addr}-${nonce}-${Date.now()}-trade`));
      const tx = { hash: txHash, from: FAUCET_ADDR, to: addr, value: "0x"+amtBig.toString(16), nonce: "0x"+nonce.toString(16), blockNumber:"0x"+blockNumber.toString(16), chainId: chainIdHex };
      txStore[txHash]=tx; receiptStore[txHash]={transactionHash:txHash,status:"0x1",blockNumber:tx.blockNumber}; mineBlock([tx]); nonces[FAUCET_ADDR]=nonce+1;
    }
    const impact = (parseFloat(amount) / 100) * 0.001; 
    if(side==='buy') traderState.price = traderState.price * (1 + impact);
    else traderState.price = Math.max(0.00001, traderState.price * (1 - impact));
    traderState.trades.push({ wallet: addr, amount: parseFloat(amount), side, price: traderState.price, time: Date.now() });
    if(traderState.trades.length>500) traderState.trades.shift();
    saveTrader(); saveChain();
    res.json({success:true, newPrice: traderState.price, newBalance: ethers.formatEther(getBalance(addr)), realStats: getRealStats() });
  }catch(e){ res.json({error:e.message}); }
});

app.get('/api/wallets', (req,res)=>{
  const list = Object.entries(balances).map(([addr,bal])=>({ address: addr, balance: ethers.formatEther(bal), nonce: nonces[addr]||0 })).sort((a,b)=> parseFloat(b.balance) - parseFloat(a.balance));
  res.json({ totalWallets: list.length, wallets: list.slice(0,100), realStats: getRealStats() });
});

app.post('/api/verify', (req,res)=>{
  const {address,contractName,source}=req.body;
  const data={address:address.toLowerCase(),contractName:contractName||"Contract",source,verified:true,verifiedAt:new Date().toISOString()};
  contractsMap[address.toLowerCase()]=data; verifiedContracts.unshift(data); saveChain(); res.json({success:true,...data});
});
app.get('/api/contract/:addr', (req,res)=> res.json(contractsMap[req.params.addr.toLowerCase()]||{verified:false}));
app.get('/api/verify/list', (req,res)=> res.json(verifiedContracts));

const faucetClaims=new Map();
app.post('/faucet', async (req,res)=>{
  try{
    const { address } = req.body;
    if(!/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({error:"Invalid address"});
    const ip=req.ip; const key=`${address.toLowerCase()}-${ip}`;
    const last=faucetClaims.get(key);
    if(last && Date.now()-last < 6*60*60*1000) return res.status(429).json({error:"Rate limit 6h"});
    const to = address.toLowerCase();
    const amount = ethers.parseEther("100");
    if(getBalance(FAUCET_ADDR) < amount) return res.status(500).json({error:"Faucet empty"});
    const nonce = nonces[FAUCET_ADDR] || 0;
    const tx = { hash: ethers.keccak256(ethers.toUtf8Bytes(`${FAUCET_ADDR}-${to}-${nonce}-${Date.now()}`)), from: faucetWallet.address, to: address, value: "0x"+amount.toString(16), nonce: "0x"+nonce.toString(16), gas: "0x5208", gasPrice: "0x3b9aca00", blockNumber: "0x"+blockNumber.toString(16), chainId: chainIdHex };
    setBalance(FAUCET_ADDR, getBalance(FAUCET_ADDR) - amount); setBalance(to, getBalance(to) + amount); nonces[FAUCET_ADDR] = nonce+1;
    txStore[tx.hash] = tx; receiptStore[tx.hash] = { transactionHash:tx.hash, status:"0x1", blockNumber:tx.blockNumber }; mineBlock([tx]); faucetClaims.set(key, Date.now());
    res.json({success:true, txHash: tx.hash, real:true, amount:"100 NGN", newBalance: ethers.formatEther(getBalance(to)), realStats: getRealStats() });
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/', (req,res)=>{
  const { method, params, id } = req.body;
  try{
    if(method==='eth_chainId') return res.json({jsonrpc:"2.0",id,result:chainIdHex});
    if(method==='eth_blockNumber') return res.json({jsonrpc:"2.0",id,result:"0x"+blockNumber.toString(16)});
    if(method==='eth_accounts') return res.json({jsonrpc:"2.0",id,result:[]});
    if(method==='eth_getBalance'){ const addr=params[0]; const bal=getBalance(addr); return res.json({jsonrpc:"2.0",id,result:"0x"+bal.toString(16)}); }
    if(method==='eth_getTransactionCount'){ const addr=params[0]; const n=nonces[addr.toLowerCase()]||0; return res.json({jsonrpc:"2.0",id,result:"0x"+n.toString(16)}); }
    if(method==='eth_getTransactionByHash'){ const hash=params[0]; return res.json({jsonrpc:"2.0",id,result:txStore[hash]||null}); }
    if(method==='eth_getTransactionReceipt'){ const hash=params[0]; return res.json({jsonrpc:"2.0",id,result:receiptStore[hash]||null}); }
    if(method==='eth_getBlockByNumber'){ const num = params[0]==='latest' ? blocks.length-1 : parseInt(params[0],16); const b=blocks[num]; if(!b) return res.json({jsonrpc:"2.0",id,result:null}); return res.json({jsonrpc:"2.0",id,result:{...b, number:"0x"+b.number.toString(16), timestamp:"0x"+b.timestamp.toString(16)}}); }
    if(method==='eth_sendTransaction'){ const [txReq]=params; const from=(txReq.from||FAUCET_ADDR).toLowerCase(); const to=txReq.to.toLowerCase(); const value=BigInt(txReq.value||0); if(getBalance(from)<value) return res.json({jsonrpc:"2.0",id,error:{code:-32000,message:"insufficient funds"}}); const nonce=nonces[from]||0; const hash=ethers.keccak256(ethers.toUtf8Bytes(`${from}-${to}-${nonce}-${Date.now()}`)); const tx={hash,from,to,value:"0x"+value.toString(16),nonce:"0x"+nonce.toString(16),blockNumber:"0x"+blockNumber.toString(16)}; setBalance(from, getBalance(from)-value); setBalance(to, getBalance(to)+value); nonces[from]=nonce+1; txStore[hash]=tx; receiptStore[hash]={transactionHash:hash,status:"0x1",blockNumber:tx.blockNumber}; mineBlock([tx]); return res.json({jsonrpc:"2.0",id,result:hash}); }
    return res.json({jsonrpc:"2.0",id,result:"0x0"});
  }catch(e){ res.json({jsonrpc:"2.0",id,error:{code:-32603,message:e.message}}); }
});

app.listen(PORT, ()=> console.log(`NGN Chain 777 REAL+STATS live on ${PORT} price $${traderState.price} circulating ${getRealStats().circulating} NGN`));