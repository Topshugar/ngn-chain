// ============================================
// NGN CHAIN 777 - Persistent Mainnet Server
// FINAL FIXED COMPILE + LOGO + BRAND
// ============================================

const express = require('express');
const cors = require('cors');
const ganache = require('ganache');
const path = require('path');
const solc = require('solc');
const fs = require('fs');

const app = express();
const CHAIN_ID = 777;
const PORT = process.env.PORT || 10000;
const MNEMONIC = process.env.MNEMONIC || "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const FAUCET_AMOUNT_HEX = '0x56BC75E2D63100000';
const FAUCET_AMOUNT_LABEL = '100 NGN';
const FAUCET_COOLDOWN = 24 * 60 * 60 * 1000;

function getLogoSVG(size = 256) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#008751"/><stop offset="100%" stop-color="#0a3d2e"/></linearGradient></defs><circle cx="128" cy="128" r="120" fill="url(#g)" stroke="#FFD700" stroke-width="6"/><path d="M128 40 L184 72 L184 136 L128 168 L72 136 L72 72 Z" fill="none" stroke="white" stroke-opacity="0.25" stroke-width="6" stroke-linejoin="round"/><text x="128" y="145" font-family="Inter, Arial Black, sans-serif" font-weight="900" font-size="88" fill="white" text-anchor="middle" letter-spacing="-3">NGN</text><g><rect x="78" y="168" width="100" height="28" rx="14" fill="#FFD700"/><text x="128" y="187" font-family="Inter, monospace" font-weight="800" font-size="20" fill="#0a3d2e" text-anchor="middle">777</text></g></svg>`;
}

const DB_PATH = path.join(__dirname, 'ngn-chain-db');
if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'] }));
app.use(express.json({ limit: '5mb' }));

const ganacheServer = ganache.server({
  chain: { chainId: CHAIN_ID, networkId: CHAIN_ID, hardfork: 'shanghai' },
  wallet: { mnemonic: MNEMONIC, totalAccounts: 10, defaultBalance: 10000, hdPath: `m/44'/${CHAIN_ID}'/0'/0/` },
  miner: { blockTime: 3, instamine: 'eager' },
  database: { dbPath: DB_PATH },
  logging: { quiet: true }
});
const provider = ganacheServer.provider;

const FAUCET_DB_FILE = path.join(DB_PATH, 'faucet.json');
let faucetClaimedByAddress = new Map();
let faucetClaimedByIP = new Map();
try {
  if (fs.existsSync(FAUCET_DB_FILE)) {
    const data = JSON.parse(fs.readFileSync(FAUCET_DB_FILE, 'utf8'));
    faucetClaimedByAddress = new Map(Object.entries(data.byAddress || {}));
    faucetClaimedByIP = new Map(Object.entries(data.byIP || {}));
  }
} catch(e) {}
function saveFaucetDB() {
  try { fs.writeFileSync(FAUCET_DB_FILE, JSON.stringify({ byAddress: Object.fromEntries(faucetClaimedByAddress), byIP: Object.fromEntries(faucetClaimedByIP) })); } catch(e) {}
}
function isRateLimited(key, store) {
  const last = store.get(key);
  return last ? Date.now() - last < FAUCET_COOLDOWN : false;
}

app.get('/logo.svg', (req, res) => { res.setHeader('Content-Type','image/svg+xml'); res.send(getLogoSVG(512)); });
app.get('/logo.png', (req, res) => { res.setHeader('Content-Type','image/svg+xml'); res.send(getLogoSVG(512)); });
app.get('/favicon.ico', (req, res) => { res.setHeader('Content-Type','image/svg+xml'); res.send(getLogoSVG(64)); });

app.get('/health', (req, res) => res.json({ status:'live', chain:'NGN Chain 777', chainId:CHAIN_ID, logo:'/logo.svg' }));
app.get('/api/stats', async (req, res) => {
  const blockNumber = await provider.request({ method: 'eth_blockNumber', params: [] });
  const accounts = await provider.request({ method: 'eth_accounts', params: [] });
  res.json({ chainId: CHAIN_ID, blockNumber: parseInt(blockNumber,16), genesisAccounts: accounts.length });
});

// ============ COMPILE FIXED ============
app.post('/compile', (req, res) => {
  try {
    const { source } = req.body;
    if (!source) return res.status(400).json({ error: 'Missing source' });
    const input = {
      language: 'Solidity',
      sources: { 'NGN.sol': { content: source } },
      settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi','evm.bytecode.object'] } } }
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    if (output.errors) {
      const errs = output.errors.filter(e => e.severity === 'error');
      if (errs.length) return res.status(400).json({ error: errs[0].formattedMessage });
    }
    const file = output.contracts['NGN.sol'];
    if (!file) return res.status(400).json({ error: 'No contract in file' });
    const name = Object.keys(file)[0];
    const c = file[name];
    res.json({ abi: c.abi, bytecode: '0x'+c.evm.bytecode.object, contractName: name, contracts: output.contracts });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/faucet', async (req, res) => {
  try {
    const { address } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({ error:'Invalid address' });
    const low = address.toLowerCase();
    if (isRateLimited(low, faucetClaimedByAddress) || isRateLimited(ip, faucetClaimedByIP)) return res.status(429).json({ error:'Already claimed, try in 24h' });
    const accounts = await provider.request({ method:'eth_accounts', params:[] });
    const from = accounts[0];
    const txHash = await provider.request({ method:'eth_sendTransaction', params:[{ from, to:address, value:FAUCET_AMOUNT_HEX }] });
    faucetClaimedByAddress.set(low, Date.now());
    faucetClaimedByIP.set(ip, Date.now());
    saveFaucetDB();
    res.json({ success:true, txHash, amount:FAUCET_AMOUNT_LABEL });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

function brandHTML(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    let html = fs.readFileSync(filePath,'utf8');
    if (!html.toLowerCase().includes('logo.svg')) html = html.replace('<head>','<head><link rel="icon" href="/logo.svg">');
    html = html.replace('<div class="dot">N</div>','<img src="/logo.svg" style="width:28px;height:28px;border-radius:8px">');
    return html;
  } catch { return null; }
}
app.use(express.static(path.join(__dirname,'public')));
app.get('/', (req,res) => { const b=brandHTML(path.join(__dirname,'public','index.html')); if(b){ res.setHeader('Content-Type','text/html'); return res.send(b);} res.sendFile(path.join(__dirname,'public','index.html')); });
app.get('/studio', (req,res) => { const b=brandHTML(path.join(__dirname,'public','studio','index.html')); if(b){ res.setHeader('Content-Type','text/html'); return res.send(b);} res.sendFile(path.join(__dirname,'public','studio','index.html')); });
app.get('/explorer', (req,res) => { const b=brandHTML(path.join(__dirname,'public','explorer','index.html')); if(b){ res.setHeader('Content-Type','text/html'); return res.send(b);} res.sendFile(path.join(__dirname,'public','explorer','index.html')); });

app.post('/', async (req,res) => {
  try {
    const result = await provider.request({ method:req.body.method, params:req.body.params||[] });
    res.json({ jsonrpc:'2.0', id:req.body.id||1, result });
  } catch(e) { res.json({ jsonrpc:'2.0', id:req.body?.id||1, error:{ code:e.code||-32000, message:e.message } }); }
});

app.listen(PORT,'0.0.0.0', () => console.log(`NGN 777 LIVE FIXED COMPILE on ${PORT}`));