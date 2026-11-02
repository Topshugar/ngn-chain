// ============================================
// NGN CHAIN 777 - Professional Mainnet Server
// Built in Lagos for Mobile-First Builders
// Chain ID: 777 | Native: NGN | EVM Compatible
// ============================================

const express = require('express');
const cors = require('cors');
const ganache = require('ganache');
const path = require('path');
const solc = require('solc');

const app = express();

// ============ CONFIG ============
const CHAIN_ID = 777;
const PORT = process.env.PORT || 10000;
const MNEMONIC = process.env.MNEMONIC || "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const FAUCET_AMOUNT_HEX = '0x56BC75E2D63100000'; // 100 NGN in wei
const FAUCET_AMOUNT_LABEL = '100 NGN';
const FAUCET_COOLDOWN = 24 * 60 * 60 * 1000; // 24h

// ============ MIDDLEWARE ============
app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'] }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ============ GANACHE CHAIN (IN-MEMORY) ============
// We do NOT call ganacheServer.listen() — Render allows only 1 port.
// We use provider directly and expose via app.post('/')
const ganacheServer = ganache.server({
  chain: { 
    chainId: CHAIN_ID, 
    networkId: CHAIN_ID,
    hardfork: 'shanghai'
  },
  wallet: { 
    mnemonic: MNEMONIC, 
    totalAccounts: 10, 
    defaultBalance: 10000, // 10k NGN per genesis account
    hdPath: `m/44'/${CHAIN_ID}'/0'/0/`
  },
  miner: {
    blockTime: 3, // 3 sec block time like BSC
    instamine: 'eager'
  },
  logging: { quiet: true }
});

// Initialize provider
const provider = ganacheServer.provider;

// ============ RATE LIMIT STORAGE ============
const faucetClaimedByAddress = new Map(); // address -> timestamp
const faucetClaimedByIP = new Map(); // ip -> timestamp

function isRateLimited(key, store) {
  const last = store.get(key);
  if (!last) return false;
  return Date.now() - last < FAUCET_COOLDOWN;
}

// Cleanup every hour to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of faucetClaimedByAddress) {
    if (now - v > FAUCET_COOLDOWN) faucetClaimedByAddress.delete(k);
  }
  for (const [k, v] of faucetClaimedByIP) {
    if (now - v > FAUCET_COOLDOWN) faucetClaimedByIP.delete(k);
  }
}, 60 * 60 * 1000);

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.json({ 
    status: 'live', 
    chain: 'NGN Chain 777',
    chainId: CHAIN_ID,
    blockTime: '3s',
    native: 'NGN',
    rpc: 'POST /',
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
      faucet: FAUCET_AMOUNT_LABEL
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
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.bytecode.sourceMap'] } }
      }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    // Return errors but don't crash
    if (output.errors) {
      const hasError = output.errors.some(e => e.severity === 'error');
      if (hasError) {
        return res.status(400).json({ 
          error: 'Compile failed',
          details: output.errors 
        });
      }
    }

    res.json(output);
  } catch (e) {
    console.error('Compile error:', e);
    res.status(500).json({ error: 'Compilation failed', message: e.message });
  }
});

// ============ FAUCET (PROFESSIONAL) ============
app.post('/faucet', async (req, res) => {
  try {
    const { address } = req.body;
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';

    // Validation
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid NGN address. Must be 0x + 40 hex chars' });
    }

    const lowerAddr = address.toLowerCase();

    // Rate limit by address
    if (isRateLimited(lowerAddr, faucetClaimedByAddress)) {
      const last = faucetClaimedByAddress.get(lowerAddr);
      const waitHrs = Math.ceil((FAUCET_COOLDOWN - (Date.now() - last)) / 3600000);
      return res.status(429).json({ error: `Already claimed. Try again in ${waitHrs}h` });
    }

    // Rate limit by IP (prevent drain)
    if (isRateLimited(clientIP, faucetClaimedByIP)) {
      return res.status(429).json({ error: 'Too many claims from this network. Try tomorrow.' });
    }

    const accounts = await provider.request({ method: 'eth_accounts', params: [] });
    if (!accounts || accounts.length === 0) {
      return res.status(500).json({ error: 'Genesis accounts not ready' });
    }

    const from = accounts[0];

    // Check genesis balance
    const balanceHex = await provider.request({ 
      method: 'eth_getBalance', 
      params: [from, 'latest'] 
    });
    const balance = BigInt(balanceHex);
    const needed = BigInt(FAUCET_AMOUNT_HEX);
    
    if (balance < needed) {
      return res.status(500).json({ error: 'Faucet dry. Contact team.' });
    }

    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: address, value: FAUCET_AMOUNT_HEX }]
    });

    // Mark claimed
    faucetClaimedByAddress.set(lowerAddr, Date.now());
    faucetClaimedByIP.set(clientIP, Date.now());

    console.log(`[FAUCET] ${FAUCET_AMOUNT_LABEL} -> ${address} | tx: ${txHash} | ip: ${clientIP}`);

    res.json({ 
      success: true, 
      txHash, 
      amount: FAUCET_AMOUNT_LABEL, 
      to: address,
      chainId: CHAIN_ID,
      explorer: `/explorer/index.html`
    });

  } catch (e) {
    console.error('Faucet error:', e);
    res.status(500).json({ error: e.message || 'Faucet failed' });
  }
});

// ============ STATIC FILES ============
app.use(express.static(path.join(__dirname, 'public')));

// Nice routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/studio', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'studio', 'index.html'));
});

app.get('/explorer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'explorer', 'index.html'));
});

app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs', 'index.html'));
});

// ============ RPC ENDPOINT - THE CHAIN ============
// All EVM JSON-RPC calls go here: eth_blockNumber, eth_sendTransaction, etc.
app.post('/', async (req, res) => {
  try {
    // Validate JSON-RPC format
    if (!req.body || !req.body.method) {
      return res.status(400).json({ error: 'Invalid JSON-RPC request' });
    }

    // Log important calls
    if (['eth_sendTransaction','eth_sendRawTransaction'].includes(req.body.method)) {
      console.log(`[RPC] ${req.body.method} from ${req.ip}`);
    }

    const result = await provider.request({
      method: req.body.method,
      params: req.body.params || []
    });

    // Standard JSON-RPC response
    res.json({
      jsonrpc: '2.0',
      id: req.body.id || 1,
      result
    });

  } catch (e) {
    // Proper JSON-RPC error format
    res.json({
      jsonrpc: '2.0',
      id: req.body?.id || 1,
      error: {
        code: e.code || -32000,
        message: e.message || 'RPC Error',
        data: e.data || null
      }
    });
  }
});

// ============ 404 ============
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', chain: 'NGN 777' });
});

// ============ START SERVER ============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`

   NGN CHAIN 777 LIVE
   Port: ${PORT}
   ChainId: ${CHAIN_ID}
   RPC: POST /
   Studio: /studio
   Explorer: /explorer
   Faucet: POST /faucet
   Health: /health

  `);
});