# NGN Chain 777 — The Mobile Chain
**Built in Lagos, for builders without laptops.**

> **LIVE:** Block #1 | 2026-11-04 | 1 USD ≈ **1346.07 NGN** | Faucet Bank: 538T NGN | Auto-Updated

Chain ID: 777 | Native Token: NGN | Block Time: ~3s | EVM: Solidity ^0.8.20 | RPC: https://ngn-chain.onrender.com

🌐 Live: https://ngn-chain.onrender.com
📱 Studio: https://ngn-chain.onrender.com/studio/
🔍 Explorer: https://ngn-chain.onrender.com/explorer/
💼 Trader: https://ngn-chain.onrender.com/trader/

### Auto-Discovered Routes (Live from /public)
- https://ngn-chain.onrender.com/explorer
- https://ngn-chain.onrender.com/faucet
- https://ngn-chain.onrender.com/miner
- https://ngn-chain.onrender.com/studio
- https://ngn-chain.onrender.com/trader

### Live FX Rate (CBN)
- **1 USD ≈ 1346.07 NGN** — Updated: 2026-11-04
- **1 NGN Test Token = $0** — Faucet only

### Why NGN Chain?
99% of Nigerian Web3 users only have a phone. Existing chains require Laptop + MetaMask desktop + Alchemy/Infura keys + $20 gas. NGN Chain removes all of that.

- Works inside Trust Wallet Browser natively
- Free 100 NGN faucet daily — Bank: 538T NGN (never dry)
- No API keys, no gatekeeping
- Custom derivation path m/44'/777'/0'/0/0
- Compile & deploy directly from mobile

### Quick Start (Phone Only)
**1. Add NGN Chain to Wallet**
Network Name: NGN Chain 777
RPC URL: https://ngn-chain.onrender.com
Chain ID: 777 (0x309)
Symbol: NGN

**2. Claim Faucet**
```bash
curl -X POST https://ngn-chain.onrender.com/faucet -H "Content-Type: application/json" -d '{"address":"0xYourAddress"}'
```
Or use Studio UI: https://ngn-chain.onrender.com/studio/

**3. Deploy Contract from Phone**
Open https://ngn-chain.onrender.com/studio/ in Trust Wallet Browser > Generate wallet (HD path 777) > Claim 100 NGN > Paste Solidity > Compile → Deploy

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
`POST / { "jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": [] }`
Supported: eth_accounts, eth_getBalance, eth_sendTransaction, eth_call, eth_estimateGas, etc.

**Faucet**
POST /faucet Body: { "address": "0x..." } Response: { success, txHash, amount: "100 NGN" } Rate limit: 1 per address + IP / 24h

**Compiler**
POST /compile Body: { "source": "pragma solidity..." }

**Stats**
GET /health → { status, chainId, uptime }
GET /api/stats → { blockNumber: 1, genesisAccounts: 10, faucetBankBalanceNGN: "538T" }

### Local Development
```bash
git clone https://github.com/Topshugar/NGN-chain.git
cd NGN-chain
npm install
npm run dev
```

### Roadmap
- [x] Chain ID 777 + custom derivation path
- [x] Mobile Studio (generate, faucet, compile, deploy)
- [x] Live Explorer
- [x] Faucet with rate limiting
- [x] Professional RPC (JSON-RPC 2.0)
- [x] Auto-README with live CBN rate — Added 2026-11-04
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
- **Current Block:** #1
- **Faucet Bank:** 538T NGN
- **Genesis Accounts:** 10
- **Live CBN Rate:** 1 USD ≈ 1346.07 NGN on 2026-11-04

License: MIT — Built in Lagos, Open for Everyone.

**Made with ❤️ in Lagos — Chain 777 — Block #1 — 1346.07 NGN/USD — 2026-11-04**
