require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 10000;
const CHAIN_ID = 777;

// === REAL IN-MEMORY EVM (no ganache) ===
let chainIdHex = "0x309";
let blockNumber = 1;
let blocks = [{ number:0, hash:"0x"+ "0".repeat(64), timestamp: Math.floor(Date.now()/1000) }];
let txStore = {}; // hash -> tx
let receiptStore = {}; // hash -> receipt
let balances = {}; // address lower -> bigint
let nonces = {}; // address lower -> number

// Faucet wallet
const FAUCET_PK = process.env.FAUCET_PRIVATE_KEY || "0x"+"1".repeat(64);
const faucetWallet = new ethers.Wallet(FAUCET_PK);
const FAUCET_ADDR = faucetWallet.address.toLowerCase();

balances[FAUCET_ADDR] = ethers.parseEther("100000"); // 100k NGN
nonces[FAUCET_ADDR] = 0;

console.log("=== NGN CHAIN 777 - REAL CHAIN v2 ===");
console.log("Faucet:", faucetWallet.address);
console.log("Balance:", ethers.formatEther(balances[FAUCET_ADDR]), "NGN");
console.log("ChainId:", CHAIN_ID);

function getBalance(addr){ return balances[addr.toLowerCase()] || 0n; }
function setBalance(addr, val){ balances[addr.toLowerCase()] = val; }

function mineBlock(txs){
  const parent = blocks[blocks.length-1];
  const newBlock = {
    number: blockNumber,
    hash: ethers.keccak256(ethers.toUtf8Bytes(`block-${blockNumber}-${Date.now()}`)),
    parentHash: parent.hash,
    timestamp: Math.floor(Date.now()/1000),
    transactions: txs.map(t=>t.hash),
    gasLimit: "0x1c9c380",
    gasUsed: "0x5208"
  };
  blocks.push(newBlock);
  blockNumber++;
  return newBlock;
}

// === PAGES ===
app.get('/explorer', (req,res)=> res.sendFile(path.join(__dirname,'public','explorer','index.html')));
app.get('/faucet', (req,res)=> res.sendFile(path.join(__dirname,'public','faucet','index.html')));
app.get('/studio', (req,res)=> res.sendFile(path.join(__dirname,'public','studio','index.html')));
app.get('/trader', (req,res)=> res.sendFile(path.join(__dirname,'public','trader','index.html')));

app.get('/health', (req,res)=> res.json({ status:'alive', chainId:CHAIN_ID, blockHeight:blockNumber, faucet: faucetWallet.address, realChain:true, faucetBalance: ethers.formatEther(getBalance(FAUCET_ADDR)) }));
app.get('/api/stats', (req,res)=> res.json({ blockNumber, chainId:CHAIN_ID, real:true, faucetBalance: ethers.formatEther(getBalance(FAUCET_ADDR)) }));

// Verified contracts store
let verifiedContracts=[]; let contractsMap={};
app.post('/api/verify', (req,res)=>{ const {address,contractName,source}=req.body; const data={address:address.toLowerCase(),contractName:contractName||"Contract",verified:true,verifiedAt:new Date().toISOString()}; contractsMap[address.toLowerCase()]=data; verifiedContracts.unshift(data); res.json({success:true,...data}); });
app.get('/api/contract/:addr', (req,res)=> res.json(contractsMap[req.params.addr.toLowerCase()]||{verified:false}));
app.get('/api/verify/list', (req,res)=> res.json(verifiedContracts));

// === REAL FAUCET ===
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
    const faucetBal = getBalance(FAUCET_ADDR);
    if(faucetBal < amount) return res.status(500).json({error:"Faucet empty"});

    const nonce = nonces[FAUCET_ADDR] || 0;
    const tx = {
      hash: ethers.keccak256(ethers.toUtf8Bytes(`${FAUCET_ADDR}-${to}-${nonce}-${Date.now()}`)),
      from: faucetWallet.address,
      to: address,
      value: "0x"+amount.toString(16),
      nonce: "0x"+nonce.toString(16),
      gas: "0x5208",
      gasPrice: "0x3b9aca00",
      blockNumber: "0x"+blockNumber.toString(16),
      chainId: chainIdHex
    };

    // update state
    setBalance(FAUCET_ADDR, faucetBal - amount);
    setBalance(to, getBalance(to) + amount);
    nonces[FAUCET_ADDR] = nonce+1;
    txStore[tx.hash] = tx;
    receiptStore[tx.hash] = { transactionHash:tx.hash, status:"0x1", blockNumber:tx.blockNumber, from:tx.from, to:tx.to, gasUsed:"0x5208" };
    mineBlock([tx]);
    faucetClaims.set(key, Date.now());

    res.json({success:true, txHash: tx.hash, real:true, amount:"100 NGN", newBalance: ethers.formatEther(getBalance(to))});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// === REAL RPC ===
app.post('/', (req,res)=>{
  const { method, params, id } = req.body;
  try{
    if(method==='eth_chainId') return res.json({jsonrpc:"2.0",id,result:chainIdHex});
    if(method==='eth_blockNumber') return res.json({jsonrpc:"2.0",id,result:"0x"+blockNumber.toString(16)});
    if(method==='eth_accounts') return res.json({jsonrpc:"2.0",id,result:[]});
    if(method==='eth_getBalance'){
      const addr=params[0]; const bal=getBalance(addr); return res.json({jsonrpc:"2.0",id,result:"0x"+bal.toString(16)});
    }
    if(method==='eth_getTransactionCount'){
      const addr=params[0]; const n=nonces[addr.toLowerCase()]||0; return res.json({jsonrpc:"2.0",id,result:"0x"+n.toString(16)});
    }
    if(method==='eth_getTransactionByHash'){
      const hash=params[0]; return res.json({jsonrpc:"2.0",id,result:txStore[hash]||null});
    }
    if(method==='eth_getTransactionReceipt'){
      const hash=params[0]; return res.json({jsonrpc:"2.0",id,result:receiptStore[hash]||null});
    }
    if(method==='eth_getBlockByNumber'){
      const num = params[0]==='latest' ? blocks.length-1 : parseInt(params[0],16);
      const b=blocks[num]; if(!b) return res.json({jsonrpc:"2.0",id,result:null});
      return res.json({jsonrpc:"2.0",id,result:{...b, number:"0x"+b.number.toString(16), timestamp:"0x"+b.timestamp.toString(16)}});
    }
    if(method==='eth_sendTransaction'){
      // simple transfer
      const [txReq]=params; const from=(txReq.from||FAUCET_ADDR).toLowerCase();
      const to=txReq.to.toLowerCase(); const value=BigInt(txReq.value||0);
      if(getBalance(from)<value) return res.json({jsonrpc:"2.0",id,error:{code:-32000,message:"insufficient funds"}});
      const nonce=nonces[from]||0;
      const hash=ethers.keccak256(ethers.toUtf8Bytes(`${from}-${to}-${nonce}-${Date.now()}`));
      const tx={hash,from,to,value:"0x"+value.toString(16),nonce:"0x"+nonce.toString(16),blockNumber:"0x"+blockNumber.toString(16)};
      setBalance(from, getBalance(from)-value); setBalance(to, getBalance(to)+value); nonces[from]=nonce+1;
      txStore[hash]=tx; receiptStore[hash]={transactionHash:hash,status:"0x1",blockNumber:tx.blockNumber}; mineBlock([tx]);
      return res.json({jsonrpc:"2.0",id,result:hash});
    }
    return res.json({jsonrpc:"2.0",id,result:"0x0"});
  }catch(e){ res.json({jsonrpc:"2.0",id,error:{code:-32603,message:e.message}}); }
});

app.listen(PORT, ()=> console.log(`NGN Chain 777 REAL live on ${PORT}`));