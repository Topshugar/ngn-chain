const hre = require("hardhat");

async function main() {
  const port = process.env.PORT || 8000;
  const host = "0.0.0.0";
  
  console.log(`Starting NGN Chain on ${host}:${port} ...`);
  
  // Start hardhat node programmatically
  await hre.run("node", {
    hostname: host,
    port: port,
    showStackTraces: true
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});