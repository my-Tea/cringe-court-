import { defineChain, type Chain } from "viem";

/**
 * Arc testnet (D14: testnet only, no mainnet config anywhere). Values are the
 * publicly documented ones as of writing and were not checked against a live
 * node from this repo; confirm before the first deployment.
 * USDC is Arc's gas token; contracts use its 6-decimal ERC-20 interface.
 */
export const arcTestnet: Chain = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});
