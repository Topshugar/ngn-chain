const ganache = require("ganache");

async function main() {
  const PORT = process.env.PORT || 10000;
  const server = ganache.server({
    wallet: { 
      mnemonic: "ngn chain naira nigeria blockchain top shugar 2024 free permanent live",
      totalAccounts: 10, 
      defaultBalance: 10000 
    },
    chain: { chainId: 7777, networkId: 7777 }
  });
  await server.listen(PORT, "0.0.0.0");
  console.log(`NGN Chain LIVE - Chain ID 7777 - Mnemonic fixed`);
}

main().catch(e => { console.error(e); process.exit(1); });