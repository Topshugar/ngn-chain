const ganache = require("ganache");

async function main() {
  const PORT = process.env.PORT || 10000;
  const server = ganache.server({
    wallet: { totalAccounts: 10, defaultBalance: 10000 },
    chain: { chainId: 7777, networkId: 7777 }
  });
  await server.listen(PORT, "0.0.0.0");
  console.log(`NGN Chain LIVE on port ${PORT} - Chain ID 7777`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});