const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const solc = require('solc');
const { ethers } = require('ethers');

const app = express();
const CHAIN_ID = 777;
const PORT = process.env.PORT || 10000;
const FAUCET_AMOUNT = ethers.parseEther("100");

console.log('🚀 NGN Chain 777 - Professional Mode (No Ganache)');

// Deterministic wallets - same 10 accounts forever
const MNEMONIC = "ngn chain lagos stable professional seed phrase seven seven seven";
const wallets = [];
for(let i=0;i<10;i++){
  const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(MNEMONIC), `m/44'/60'/0'/0/${i}`);
  wallets.push(wallet);
}
const accounts = wallets.map(w=>w.address);
let balances = {};
accounts.forEach(a=> balances[a.toLowerCase()] = ethers.parseEther("100000"));
let blockNumber = 355;
let transactions = {};

console.log(`📁 Accounts: ${accounts[0]}...`);

function getLogoSVG(size=256){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256"><circle cx="128" cy="128" r="120" fill="#008751" stroke="#FFD700" stroke-width="6"/><text x="128" y="145" font-family="Arial Black" font-weight="900" font-size="88" fill="white" text-anchor="middle">NGN</text></svg>`;
}

app.use(cors({origin:'*'}));
app.use(express.json({limit:'5mb'}));

app.get('/logo.svg',(req,res)=>{res.setHeader('Content-Type','image/svg+xml');res.send(getLogoSVG(512));});
app.get('/health',(req,res)=>res.json({status:'live',chain:'NGN Chain 777',chainId:CHAIN_ID, blockNumber}));
app.get('/api/stats', async (req,res)=>{
  res.json({chainId:CHAIN_ID, blockNumber, genesisAccounts: accounts.length, faucetBankBalanceNGN: Number(ethers.formatEther(balances[accounts[0].toLowerCase()]||0n)) });
});

app.post('/compile',(req,res)=>{
  try{
    const {source}=req.body;
    const input={language:'Solidity',sources:{'NGN.sol':{content:source}},settings:{optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
    const output=JSON.parse(solc.compile(JSON.stringify(input)));
    if(output.errors){const errs=output.errors.filter(e=>e.severity==='error'); if(errs.length) return res.status(400).json({error:errs[0].formattedMessage});}
    const file=output.contracts['NGN.sol']; const name=Object.keys(file)[0]; const c=file[name];
    res.json({abi:c.abi, bytecode:'0x'+c.evm.bytecode.object, contractName:name});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/faucet', async (req,res)=>{
  try{
    const {address}=req.body;
    if(!address||!/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({error:'Invalid address'});
    const to=address.toLowerCase();
    const from=accounts[0].toLowerCase();
    if((balances[from]||0n) < FAUCET_AMOUNT) return res.status(500).json({error:'Faucet empty'});
    balances[from]-=FAUCET_AMOUNT;
    balances[to]=(balances[to]||0n)+FAUCET_AMOUNT;
    blockNumber++;
    const txHash=ethers.keccak256(ethers.toUtf8Bytes(Date.now()+address));
    transactions[txHash]={hash:txHash, from:accounts[0], to:address, value: FAUCET_AMOUNT.toString()};
    res.json({success:true, txHash, amount:'100 NGN'});
  }catch(e){res.status(500).json({error:e.message});}
});

// RPC - Main chain endpoint
app.post('/', async (req,res)=>{
  const {method, params, id}=req.body;
  try{
    let result;
    switch(method){
      case 'eth_chainId': result='0x'+CHAIN_ID.toString(16); break;
      case 'net_version': result=CHAIN_ID.toString(); break;
      case 'eth_blockNumber': result='0x'+blockNumber.toString(16); break;
      case 'eth_accounts': result=accounts; break;
      case 'eth_getBalance': {
        const addr=params[0].toLowerCase();
        const bal=balances[addr]||0n;
        result='0x'+bal.toString(16);
        break;
      }
      case 'eth_gasPrice': result='0x3B9ACA00'; break;
      case 'eth_estimateGas': result='0x5208'; break;
      case 'eth_sendTransaction': {
        const tx=params[0];
        const from=tx.from.toLowerCase();
        const to=(tx.to||'').toLowerCase();
        const value=tx.value?BigInt(tx.value):0n;
        if((balances[from]||0n) < value) throw new Error('Insufficient balance');
        if(to) balances[to]=(balances[to]||0n)+value;
        balances[from]-=value;
        blockNumber++;
        const hash=ethers.keccak256(ethers.toUtf8Bytes(Date.now()+Math.random()));
        transactions[hash]={hash, from:tx.from, to:tx.to, value:value.toString()};
        result=hash;
        break;
      }
      case 'eth_getTransactionByHash': result=transactions[params[0]]||null; break;
      case 'eth_getTransactionReceipt': {
        const tx=transactions[params[0]];
        if(!tx) result=null;
        else result={transactionHash:params[0], status:'0x1', blockNumber:'0x'+blockNumber.toString(16), gasUsed:'0x5208'};
        break;
      }
      case 'eth_call': result='0x'; break;
      default: result='0x0';
    }
    res.json({jsonrpc:'2.0', id, result});
  }catch(e){
    res.json({jsonrpc:'2.0', id, error:{code:-32000, message:e.message}});
  }
});

app.use(express.static(path.join(__dirname,'public')));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/trader',(req,res)=>res.sendFile(path.join(__dirname,'public','trader','index.html')));
app.get('/explorer',(req,res)=>res.sendFile(path.join(__dirname,'public','explorer','index.html')));
app.get('/studio',(req,res)=>res.sendFile(path.join(__dirname,'public','studio','index.html')));

app.listen(PORT,'0.0.0.0',()=>console.log(`✅ NGN 777 LIVE on ${PORT} - Block ${blockNumber}`));