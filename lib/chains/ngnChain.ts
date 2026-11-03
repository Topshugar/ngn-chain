import { defineChain } from 'viem'

export const ngnChain = defineChain({
  id: 777,
  name: 'NGN Chain 777',
  network: 'ngn-chain-777',
  nativeCurrency: { name: 'NGN', symbol: 'NGN', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://ngn-chain.onrender.com'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://ngn-chain.onrender.com/explorer' },
  },
})