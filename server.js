const ganache = require("ganache");

async function main() {
  const PORT = process.env.PORT || 10000;
  
  const server = ganache.server({
    wallet: {
      totalAccounts: 10,
      defaultBalance: 10000
    },
    chain: {
      chainId: 7777,
      networkId: 7777
    },
    logging: {
      quiet: false
    }
  });

  await server.listen(PORT, "0.0.0.0");
  console.log(`NGN Chain LIVE on 0.0.0.0:${PORT}`);
  console.log(`Chain ID: 7777`);
  console.log(`RPC ready`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});