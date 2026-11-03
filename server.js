const express = require('express');
const cors = require('cors');
const ganache = require('ganache');
const path = require('path');
const solc = require('solc');
const fs = require('fs');

const app = express();
const CHAIN_ID = 777;
const PORT = process.env.PORT || 10000;
const FAUCET_AMOUNT_HEX = '0x56BC75E2D63100000';
const FAUCET_AMOUNT_LABEL = '100 NGN';
const FAUCET_COOLDOWN = 24 * 60 * 60 * 1000;

console.log('🚀 Starting NGN Chain 777 - Professional Mode');

function getLogoSVG(size = 256) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#008751"/><stop offset="100%" stop-color="#0a3d2e"/></linearGradient></defs><circle cx="128" cy="128" r="120" fill="url(#g)" stroke="#FFD700" stroke-width="6"/><text x="128" y="145" font-family="Inter, Arial Black, sans-serif" font-weight="900" font-size="88" fill="white" text-anchor="middle" letter-spacing="-3">NGN</text><g><rect x="78" y="168" width="100" height="28" rx="14" fill="#FFD700"/><text x="128" y="187" font-family="Inter, monospace" font-weight="800" font-size="20" fill="#0a3d2e" text-anchor="middle">777</text></g></svg>`;
}

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'] }));
app.use(express.json({ limit: '5mb' }));

// PROFESSIONAL GANACHE - MEMORY ONLY, NO DISK DB (fixes your crash)
const ganacheServer = ganache.server({
  chain: { 
    chainId: CHAIN_ID, 
    networkId: CHAIN_ID, 
    hardfork: 'shanghai',
    allowUnlimitedContractSize: true
  },
  wallet: { 
    totalAccounts: 10,
    defaultBalance: 100000,
    seed: "ngn-chain-777-lagos-stable-v1-professional",
    deterministic: true
  },
  miner: { blockTime: 2 },
  logging: { quiet: true }
});

const provider = ganacheServer.provider;

// Faucet rate limit (in-memory + file safe)
const FAUCET_FILE = path.join(__dirname, 'faucet.json');
let faucetByAddress = new Map();
let faucetByIP = new Map();
try {
  if (fs.existsSync(FAUCET_FILE)) {
    const d = JSON.parse(fs.readFileSync(FAUCET_FILE, 'utf8'));
    faucetByAddress = new Map(Object.entries(d.byAddress || {}));
    faucetByIP = new Map(Object.entries(d.byIP || {}));
  }
} catch(e) {}
function saveFaucet(){ try{ fs.writeFileSync(FAUCET_FILE, JSON.stringify({ byAddress: Object.fromEntries(faucetByAddress), byIP: Object.fromEntries(faucetByIP) })); }catch(e){} }
function isLimited(k,s){ const l=s.get(k); return l ? Date.now()-l < FAUCET_COOLDOWN : false; }

// Static assets
app.get('/logo.svg', (req,res)=>{ res.setHeader('Content-Type','image/svg+xml'); res.send(getLogoSVG(512)); });
app.get('/logo.png', (req,res)=>{ res.setHeader('Content-Type','image/svg+xml'); res.send(getLogoSVG(512)); });
app.get('/favicon.ico', (req,res)=>{ res.setHeader('Content-Type','image/svg+xml'); res.send(getLogoSVG(64)); });

app.get('/health', (req,res)=> res.json({ status:'live', chain:'NGN Chain 777', chainId: CHAIN_ID, mode: 'professional-memory' }));
app.get('/api/stats', async (req,res)=>{
  const blockNumber = await provider.request({ method:'eth_blockNumber', params:[] });
  const accounts = await provider.request({ method:'eth_accounts', params:[] });
  const bal = await provider.request({ method:'eth_getBalance', params:[accounts[0], 'latest'] });
  res.json({ chainId: CHAIN_ID, blockNumber: parseInt(blockNumber,16), genesisAccounts: accounts.length, faucetBankBalanceNGN: parseInt(bal,16)/1e18 });
});

app.post('/compile', (req,res)=>{
  try{
    const { source } = req.body;
    if(!source) return res.status(400).json({ error:'Missing source' });
    const input = { language:'Solidity', sources:{'NGN.sol':{content:source}}, settings:{ optimizer:{enabled:true,runs:200}, outputSelection:{'*':{'*':['abi','evm.bytecode.object']}} } };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    if(output.errors){ const errs=output.errors.filter(e=>e.severity==='error'); if(errs.length) return res.status(400).json({error:errs[0].formattedMessage}); }
    const file=output.contracts['NGN.sol']; if(!file) return res.status(400).json({error:'No contract'});
    const name=Object.keys(file)[0]; const c=file[name];
    res.json({ abi:c.abi, bytecode:'0x'+c.evm.bytecode.object, contractName:name });
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/faucet', async (req,res)=>{
  try{
    const { address } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    if(!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({error:'Invalid address'});
    const low=address.toLowerCase();
    if(isLimited(low,faucetByAddress) || isLimited(ip,faucetByIP)) return res.status(429).json({error:'Already claimed, try in 24h'});
    const accounts=await provider.request({method:'eth_accounts',params:[]});
    const from=accounts[0];
    const txHash=await provider.request({method:'eth_sendTransaction',params:[{from,to:address,value:FAUCET_AMOUNT_HEX}]});
    faucetByAddress.set(low,Date.now()); faucetByIP.set(ip,Date.now()); saveFaucet();
    res.json({success:true,txHash,amount:FAUCET_AMOUNT_LABEL});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Admin helpers
app.get('/admin/reset-faucet/:address', (req,res)=>{ faucetByAddress.delete(req.params.address.toLowerCase()); saveFaucet(); res.json({ok:true}); });
app.get('/admin/reset-all-faucet', (req,res)=>{ faucetByAddress.clear(); faucetByIP.clear(); saveFaucet(); res.json({ok:true}); });

// Static frontend
app.use(express.static(path.join(__dirname,'public')));
app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/studio', (req,res)=> res.sendFile(path.join(__dirname,'public','studio','index.html')));
app.get('/explorer', (req,res)=> res.sendFile(path.join(__dirname,'public','explorer','index.html')));
app.get('/trader', (req,res)=> res.sendFile(path.join(__dirname,'public','trader','index.html')));

// RPC endpoint - main chain
app.post('/', async (req,res)=>{
  try{
    const result=await provider.request({method:req.body.method, params:req.body.params||[]});
    res.json({jsonrpc:'2.0', id:req.body.id||1, result});
  }catch(e){ res.json({jsonrpc:'2.0', id:req.body?.id||1, error:{code:e.code||-32000, message:e.message}}); }
});

app.listen(PORT,'0.0.0.0', ()=> console.log(`✅ NGN 777 LIVE on ${PORT} | Chain ID ${CHAIN_ID} | No DB crash mode`));