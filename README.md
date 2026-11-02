
# NGN Chain 777 — The Mobile Chain

> *Built in Lagos, for builders without laptops.*

NGN Chain 777 is a mobile-first EVM Layer 1 blockchain. Generate wallets, claim gas, and deploy Solidity contracts — all from your phone inside Trust Wallet or MetaMask mobile browser.

*Chain ID: 777 | Native Token: NGN | Block Time: ∼3s | EVM: Solidity ^0.8.20*

🌐 *Live:* https://ngn-chain.onrender.com  
📱 *Studio:* https://ngn-chain.onrender.com/studio/  
🔍 *Explorer:* https://ngn-chain.onrender.com/explorer/

---

## Why NGN Chain?

99% of Nigerian Web3 users only have a phone. Existing chains require:
- Laptop + MetaMask desktop
- Alchemy/Infura API keys
- $20 for gas

*NGN Chain removes all of that.*

- Works inside Trust Wallet Browser natively
- Free 100 NGN faucet daily
- No API keys, no gatekeeping
- Custom derivation path `m/44'/777'/0'/0/0`
- Compile & deploy directly from mobile

## Quick Start (Phone Only)

### 1. Add NGN Chain to Wallet

Click this button on mobile: `Add to Wallet in 1 Click`

Or add manually:
Network Name: NGN Chain 777
RPC URL: https://ngn-chain.onrender.com
Chain ID: 777
Currency Symbol: NGN
Explorer: https://ngn-chain.onrender.com
Chain ID hex: `0x309`

### 2. Claim Faucet
curl -X POST https://ngn-chain.onrender.com/faucet \
  -H "Content-Type: application/json" \
  -d '{"address":"0xYourAddress"}'
Or use Studio UI: `/studio`

### 3. Deploy Contract from Phone

1. Open https://ngn-chain.onrender.com/studio in Trust Wallet Browser
2. Generate wallet (HD path 777)
3. Claim 100 NGN
4. Paste Solidity code:
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract NGN {
    string public name = "NGN Chain";
    function sayHi() public pure returns (string memory) {
        return "Built in Lagos!";
    }
}
5. Compile → Deploy

Done. You deployed from phone.

## Architecture
┌─────────────────┐
│  Mobile Studio  │  React-less, vanilla JS for Trust Wallet
│  /studio/       │  Wallet Gen + Faucet + Compiler + Deployer
├─────────────────┤
│  Explorer       │  Live blocks/txs, search address/tx/block
│  /explorer/     │
├─────────────────┤
│  RPC Layer      │  POST / — Full EVM JSON-RPC
│  server.js      │  Ganache in-memory, 3s blocks, Shanghai hardfork
├─────────────────┤
│  Chain ID 777   │  m/44'/777' — Own BIP standard
└─────────────────┘
### Tech Stack

- *Runtime:* http://Node.js 18+ / Express 4
- *Chain:* Ganache 7.9.2 (EVM, instamine eager)
- *Compiler:* solc 0.8.19 (optimizer enabled)
- *Wallet:* http://ethers.js 5.7.2 + BIP39/BIP32
- *Frontend:* Vanilla HTML/CSS/JS — No build step, mobile-first

## API

### RPC (EVM Compatible)

All standard methods work:
POST / 
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_blockNumber",
  "params": []
}
Supported: `eth_accounts`, `eth_getBalance`, `eth_sendTransaction`, `eth_call`, `eth_estimateGas`, etc.

### Faucet
POST /faucet
Body: { "address": "0x..." }
Response: { "success": true, "txHash": "0x...", "amount": "100 NGN" }
Rate limit: 1 per address + 1 per IP per 24h
### Compiler
POST /compile
Body: { "source": "pragma solidity..." }
Response: solc JSON output (abi + bytecode)
### Stats
GET /health → { status, chainId, uptime }
GET /api/stats → { blockNumber, genesisAccounts }
## Local Development
git clone https://github.com/yourusername/ngn-chain-777.git
cd ngn-chain-777
npm install
npm run dev
Open http://localhost:10000

## Roadmap

- [x] Chain ID 777 + custom derivation path
- [x] Mobile Studio (generate, faucet, compile, deploy)
- [x] Live Explorer
- [x] Faucet with rate limiting
- [x] Professional RPC (JSON-RPC 2.0 compliant)
- [ ] Contract verification in explorer
- [ ] Public testnet with persistent DB (LevelDB)
- [ ] Bridge to Base / Lisk
- [ ] NGN Stable Token (naira-pegged)
- [ ] Ajo/Esusu savings contracts (on-chain)

## Use Cases Built on NGN 777

1.  *Education:* University students learn Solidity on phone
2.  *Payments:* Market traders P2P via QR, 3s settlement
3.  *Creators:* Artists mint NFTs from studio
4.  *Community Savings:* Transparent Ajo on-chain
5.  *Launchpad:* Anyone can launch token on Chain 777

## Security

- Faucet rate-limited by address + IP (24h)
- Compiler input limited to 50kb
- CORS enabled for wallet browsers
- No private keys stored server-side — all wallet generation client-side
- Genesis mnemonic should be set via `MNEMONIC` env var in production

## For Grants / Investors

> NGN Chain is onboarding the next 10M Web3 users who only have phones.

We are mobile-first, Africa-first, and already working inside Trust Wallet — where 90% of Nigerian crypto users live.

Pitch deck available on request.

## License

MIT — Built in Lagos, Open for Everyone.

## Team

Built by builders who only had phones.

Twitter: https://twitter.com/NGNChain777  
Contact: ngnchain777@gmail.com

---

*Made with ❤️ in Lagos — Chain 777*