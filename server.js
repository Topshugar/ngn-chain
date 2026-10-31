const hre = require("hardhat");

async function main() {
  const PORT = process.env.PORT || 10000;
  console.log(`NGN Chain starting on port ${PORT}...`);
  
  const node = await hre.run("node", {
    hostname: "0.0.0.0",
    port: PORT
  });
}

main().catch(console.error);