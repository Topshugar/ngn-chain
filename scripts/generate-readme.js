const fs = require('fs');
const path = require('path');

const RPC = 'https://ngn-chain.onrender.com';
const REPO_URL = 'https://github.com/Topshugar/NGN-chain';

async function getCBN() {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const j = await res.json();
    return {
      rate: Number(j.rates.NGN).toFixed(2),
      date: new Date().toISOString().slice(0, 10)
    };
  } catch (e) {
    return { rate: '1346.00', date: new Date().toISOString().slice(0, 10) };
  }
}

async function getStats() {
  try {
    const res = await fetch(RPC + '/api/stats');
    const j = await res.json();
    return {
      block: j.blockNumber || j.block_number || 0,
      bank: j.faucetBankBalanceNGN || '538T',
      accounts: j.genesisAccounts || 10
    };
  } catch (e) {
    return { block: 0, bank: '538T', accounts: 10 };
  }
}

function getRoutes() {
  const pub = path.join(process.cwd(), 'public');
  if (!fs.existsSync(pub)) return ['/studio', '/explorer', '/trader'];
  return fs.readdirSync(pub)
    .filter(f => fs.statSync(path.join(pub, f)).isDirectory())
    .map(d => `/${d}`);
}

async function main() {
  const cbn = await getCBN();
  const stats = await getStats();
  const routes = getRoutes();

  const md = `# NGN Chain 777 — The Mobile Chain
**Built in Lagos, for builders without laptops.**

> **LIVE:** Block #${stats.block} | ${cbn.date} | 1 USD ≈ **${cbn.rate} NGN** | Faucet Bank: ${stats.bank} NGN | Auto-Updated

Chain ID: 777 | Native Token: NGN | Block Time: ~3s | EVM: Solidity ^0.8.20 | RPC: ${RPC}

🌐 Live: ${RPC}
📱 Studio: ${RPC}/studio/
🔍 Explorer: ${RPC}/explorer/
💼 Trader: ${RPC}/trader/

### Auto-Discovered Routes (Live from /public)
${routes.map(r => `- ${RPC}${r}`).join('\n')}

### Live FX Rate (CBN)
- **1 USD ≈ ${cbn.rate} NGN** — Updated: ${cbn.date}
- **1 NGN Test Token = $0** — Faucet only

### Why NGN Chain?
99% of Nigerian Web3 users only have a phone. Existing chains require Laptop + MetaMask desktop + Alchemy/Infura keys + $20 gas. NGN Chain removes all of that.

- Works inside Trust Wallet Browser natively
- Free 100 NGN faucet daily — Bank: ${stats.bank} NGN (never dry)
- No API keys, no gatekeeping
- Custom derivation path m/44'/777'/0'/0/0
- Compile & deploy directly from mobile

### Quick Start (Phone Only)
**1. Add NGN Chain to Wallet**
Network Name: NGN Chain 777
RPC URL: ${RPC}
Chain ID: 777 (0x309)
Symbol: NGN

**2. Claim Faucet**
\`\`\`bash
curl -X POST ${RPC}/faucet -H "Content-Type: application/json" -d '{"address":"0xYourAddress"}'
\`\`\`
Or use Studio UI: ${RPC}/studio/

**3. Deploy Contract from Phone**
Open ${RPC}/studio/ in Trust Wallet Browser > Generate wallet (HD path 777) > Claim 100 NGN > Paste Solidity > Compile → Deploy

### Architecture
Studio: /studio/ — Wallet Gen + Faucet + Compiler
Explorer: /explorer/ — Live blocks/txs
Trader: /trader/
RPC Layer: POST / — Full EVM JSON-RPC (Ganache 7.9.2, 3s blocks, Shanghai)
Chain ID 777 — m/44'/777'

### Tech Stack
Runtime: Node.js 18+ / Express 4
Chain: Ganache 7.9.2 (EVM)
Compiler: solc 0.8.19
Wallet: ethers.js 5.7.2 + BIP39/BIP32
Frontend: Vanilla HTML/CSS/JS — No build step, mobile-first

### API
**RPC (EVM Compatible)**
\`POST / { "jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": [] }\`
Supported: eth_accounts, eth_getBalance, eth_sendTransaction, eth_call, eth_estimateGas, etc.

**Faucet**
POST /faucet Body: { "address": "0x..." } Response: { success, txHash, amount: "100 NGN" } Rate limit: 1 per address + IP / 24h

**Compiler**
POST /compile Body: { "source": "pragma solidity..." }

**Stats**
GET /health → { status, chainId, uptime }
GET /api/stats → { blockNumber: ${stats.block}, genesisAccounts: ${stats.accounts}, faucetBankBalanceNGN: "${stats.bank}" }

### Local Development
\`\`\`bash
git clone ${REPO_URL}.git
cd NGN-chain
npm install
npm run dev
\`\`\`

### Roadmap
- [x] Chain ID 777 + custom derivation path
- [x] Mobile Studio (generate, faucet, compile, deploy)
- [x] Live Explorer
- [x] Faucet with rate limiting
- [x] Professional RPC (JSON-RPC 2.0)
- [x] Auto-README with live CBN rate — Added ${cbn.date}
- [ ] Contract verification in explorer
- [ ] Public testnet with persistent DB
- [ ] Bridge to Base / Lisk
- [ ] NGN Stable Token (naira-pegged)

### Use Cases Built on NGN 777
Education: Students learn Solidity on phone
Payments: Market traders P2P via QR, 3s settlement
Creators: Artists mint NFTs from studio
Community Savings: Transparent Ajo on-chain

### Security
Faucet rate-limited by address + IP (24h)
Compiler input limited to 50kb
CORS enabled for wallet browsers
No private keys stored server-side — all wallet generation client-side

### Stats (Live)
- **Current Block:** #${stats.block}
- **Faucet Bank:** ${stats.bank} NGN
- **Genesis Accounts:** ${stats.accounts}
- **Live CBN Rate:** 1 USD ≈ ${cbn.rate} NGN on ${cbn.date}

License: MIT — Built in Lagos, Open for Everyone.

**Made with ❤️ in Lagos — Chain 777 — Block #${stats.block} — ${cbn.rate} NGN/USD — ${cbn.date}**
`;

  fs.writeFileSync('README.md', md, 'utf8');
  console.log(`README.md generated ✓ Block #${stats.block} | ${cbn.rate} NGN | Routes: ${routes.join(', ')}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});