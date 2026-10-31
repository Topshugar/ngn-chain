const ganache = require("ganache");
const http = require("http");

async function main() {
  const PORT = process.env.PORT || 10000;
  
  const ganacheServer = ganache.server({
    wallet: { totalAccounts: 10, defaultBalance: 10000 },
    chain: { chainId: 7777, networkId: 7777 }
  });

  const httpServer = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <h1>NGN Chain LIVE! 🎉</h1>
        <p>Chain ID: 7777</p>
        <p>RPC URL: ${req.headers.host}</p>
        <p>Use this URL in MetaMask / Remix</p>
        <p>Status: Running on Render Free</p>
      `);
      return;
    }
    // For POST (blockchain transactions) forward to ganache
    ganacheServer.handleRequest(req, res);
  });

  await new Promise(resolve => httpServer.listen(PORT, "0.0.0.0", resolve));
  console.log(`NGN Chain LIVE on port ${PORT}`);
}

main().catch(console.error);