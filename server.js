// ============================================
// NGN CHAIN 777 - Persistent Mainnet Server
// Built in Lagos for Mobile-First Builders
// Chain ID: 777 | Native: NGN | EVM Compatible
// ============================================

const express = require('express');
const cors = require('cors');
const ganache = require('ganache');
const path = require('path');
const solc = require('solc');
const fs = require('fs');

const app = express();

// ============ CONFIG ============
const CHAIN_ID = 777;
const PORT = process.env.PORT || 10000;
const MNEMONIC = process.env.MNEMONIC || "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const FAUCET_AMOUNT_HEX = '0x56BC75E2D63100000'; // 100 NGN
const FAUCET_AMOUNT_LABEL = '100 NGN';
const FAUCET_COOLDOWN = 24 * 60 * 60 * 1000;

// ============ DB PERSISTENCE ============
const DB_PATH = path.join(__dirname, 'ngn-chain-db');
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
  console.log(`[DB] Created persistence folder: ${DB_PATH}`);
} else {
  console.log(`[DB] Using existing chain data: ${DB_PATH}`);
}

// ============ MIDDLEWARE ============
app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'] }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ============ GANACHE CHAIN (PERSISTENT) ============
const ganacheServer = ganache.server({
  chain: { 
    chainId: CHAIN_ID, 
    networkId: CHAIN_ID,
    hardfork: 'shanghai'
  },
  wallet: { 
    mnemonic: MNEMONIC, 
    totalAccounts: 10, 
    defaultBalance: 10000,
    hdPath: `m/44'/${CHAIN_ID}'/0'/0/`
  },
  miner: {
    blockTime: 3,
    instamine: 'eager'
  },
  database: {
    dbPath: DB_PATH
  },
  logging: { quiet: true }
});

const provider = ganacheServer.provider;

// ============ RATE LIMIT STORAGE (PERSISTENT JSON) ============
const FAUCET_DB_FILE = path.join(DB_PATH, 'faucet.json');
let faucetClaimedByAddress = new Map();
let faucetClaimedByIP = new Map();

// Load faucet history if exists
try {
  if (fs.existsSync(FAUCET_DB_FILE)) {
    const data = JSON.parse(fs.readFileSync(FAUCET_DB_FILE, 'utf8'));
    faucetClaimedByAddress = new Map(Object.entries(data.byAddress || {}));
    faucetClaimedByIP = new Map(Object.entries(data.byIP || {}));
    console.log(`[FAUCET] Restored ${faucetClaimedByAddress.size} claims`);
  }
} catch(e) { console.log('[FAUCET] No previous faucet DB'); }

function saveFaucetDB() {
  try {
    fs.writeFileSync(FAUCET_DB_FILE, JSON.stringify({
      byAddress: Object.fromEntries(faucetClaimedByAddress),
      byIP: Object.fromEntries(faucetClaimedByIP)
    }));
  } catch(e) { console.error('Faucet save fail', e); }
}

function isRateLimited(key, store) {
  const last = store.get(key);
  if (!last) return false;
  return Date.now() - last < FAUCET_COOLDOWN;
}

setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [k, v] of faucetClaimedByAddress) {
    if (now - v > FAUCET_COOLDOWN) { faucetClaimedByAddress.delete(k); changed=true; }
  }
  for (const [k, v] of faucetClaimedByIP) {
    if (now - v > FAUCET_COOLDOWN) { faucetClaimedByIP.delete(k); changed=true; }
  }
  if (changed) saveFaucetDB();
}, 60 * 60 * 1000);

// Keep Render alive
setInterval(() => {
  console.log(`[NGN 777] Alive — Uptime ${Math.floor(process.uptime()/60)}m — DB: ${DB_PATH}`);
}, 5 * 60 * 1000);

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.json({ 
    status: 'live', 
    chain: 'NGN Chain 777',
    chainId: CHAIN_ID,
    blockTime: '3s',
    native: 'NGN',
    rpc: 'POST /',
    persistent: true,
    db: fs.existsSync(DB_PATH) ? 'ok' : 'missing',
    uptime: process.uptime()
  });
});

app.get('/api/stats', async (req, res) => {
  try {
    const blockNumber = await provider.request({ method: 'eth_blockNumber', params: [] });
    const accounts = await provider.request({ method: 'eth_accounts', params: [] });
    res.json({
      chainId: CHAIN_ID,
      blockNumber: parseInt(blockNumber, 16),
      genesisAccounts: accounts.length,
      faucet: FAUCET_AMOUNT_LABEL,
      persistent: true,
      faucetClaims: faucetClaimedByAddress.size
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ SOLIDITY COMPILER ============
app.post('/compile', (req, res) => {
  try {
    const { source } = req.body;
    if (!source || typeof source !== 'string') {
      return res.status(400).json({ error: 'Missing source code' });
    }
    if (source.length > 50000) {
      return res.status(400).json({ error: 'Source too large (max 50kb)' });
    }
    const input = {
      language: 'Solidity',
      sources: { 'NGN.sol': { content: source } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
      }
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    if (output.errors) {
      const hasError = output.errors.some(e => e.severity === 'error');
      if (hasError) {
        return res.status(400).json({ error: 'Compile failed', details: output.errors });
      }
    }
    res.json(output);
  } catch (e) {
    console.error('Compile error:', e);
    res.status(500).json({ error: 'Compilation failed', message: e.message });
  }
});

// ============ FAUCET (PERSISTENT) ============
app.post('/faucet', async (req, res) => {
  try {
    const { address } = req.body;
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid NGN address. Must be 0x + 40 hex chars' });
    }
    const lowerAddr = address.toLowerCase();
    if (isRateLimited(lowerAddr, faucetClaimedByAddress)) {
      const last = faucetClaimedByAddress.get(lowerAddr);
      const waitHrs = Math.ceil((FAUCET_COOLDOWN - (Date.now() - last)) / 3600000);
      return res.status(429).json({ error: `Already claimed. Try again in ${waitHrs}h` });
    }
    if (isRateLimited(clientIP, faucetClaimedByIP)) {
      return res.status(429).json({ error: 'Too many claims from this network. Try tomorrow.' });
    }
    const accounts = await provider.request({ method: 'eth_accounts', params: [] });
    if (!accounts || accounts.length === 0) {
      return res.status(500).json({ error: 'Genesis accounts not ready' });
    }
    const from = accounts[0];
    const balanceHex = await provider.request({ method: 'eth_getBalance', params: [from, 'latest'] });
    const balance = BigInt(balanceHex);
    const needed = BigInt(FAUCET_AMOUNT_HEX);
    if (balance < needed) {
      return res.status(500).json({ error: 'Faucet dry. Contact team.' });
    }
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: address, value: FAUCET_AMOUNT_HEX }]
    });
    faucetClaimedByAddress.set(lowerAddr, Date.now());
    faucetClaimedByIP.set(clientIP, Date.now());
    saveFaucetDB();
    console.log(`[FAUCET] ${FAUCET_AMOUNT_LABEL} -> ${address} | tx: ${txHash}`);
    res.json({ 
      success: true, 
      txHash, 
      amount: FAUCET_AMOUNT_LABEL, 
      to: address,
      chainId: CHAIN_ID,
      persistent: true
    });
  } catch (e) {
    console.error('Faucet error:', e);
    res.status(500).json({ error: e.message || 'Faucet failed' });
  }
});

// ============ STATIC FILES ============
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/studio', (req, res) => res.sendFile(path.join(__dirname, 'public', 'studio', 'index.html')));
app.get('/explorer', (req, res) => res.sendFile(path.join(__dirname, 'public', 'explorer', 'index.html')));
app.get('/docs', (req, res) => res.sendFile(path.join(__dirname, 'public', 'docs', 'index.html')));

// ============ RPC ENDPOINT ============
app.post('/', async (req, res) => {
  try {
    if (!req.body || !req.body.method) {
      return res.status(400).json({ error: 'Invalid JSON-RPC request' });
    }
    if (['eth_sendTransaction','eth_sendRawTransaction'].includes(req.body.method)) {
      console.log(`[RPC] ${req.body.method} from ${req.ip}`);
    }
    const result = await provider.request({
      method: req.body.method,
      params: req.body.params || []
    });
    res.json({ jsonrpc: '2.0', id: req.body.id || 1, result });
  } catch (e) {
    res.json({
      jsonrpc: '2.0',
      id: req.body?.id || 1,
      error: { code: e.code || -32000, message: e.message || 'RPC Error', data: e.data || null }
    });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Not found', chain: 'NGN 777' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
   NGN CHAIN 777 LIVE [PERSISTENT]
   Port: ${PORT}
   ChainId: ${CHAIN_ID}
   DB: ${DB_PATH}
   RPC: POST /
   Studio: /studio
   Explorer: /explorer
   Faucet: POST /faucet
  `);
});