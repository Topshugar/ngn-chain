const ganache = require("ganache");

async function main() {
  const PORT = process.env.PORT || 10000;
  
  const options = {
    wallet: { 
mnemonic: "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat",
      totalAccounts: 10, 
      defaultBalance: 10000 
    },
    chain: { chainId: 7777, networkId: 7777 },
    logging: { quiet: false, verbose: true }
  };

  const server = ganache.server(options);
  
  await server.listen(PORT, "0.0.0.0");
  
  const provider = server.provider;
  const accounts = await provider.request({ method: "eth_accounts", params: [] });
  
  console.log("==================================================");
  console.log("NGN CHAIN LIVE - COPY THESE KEYS NOW");
  console.log("==================================================");
  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    console.log(`Account ${i}: ${acc}`);
  }
  console.log("==================================================");
  console.log("Mnemonic: ngn chain naira nigeria blockchain top shugar 2024 free permanent live");
  console.log("Use this mnemonic to import ALL accounts at once in MetaMask");
  console.log("==================================================");
}

main().catch(e => { console.error(e); process.exit(1); });