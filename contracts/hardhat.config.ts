import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// Testnet only (DECISIONS D14). No private keys are read here: the Arc testnet
// entry has no accounts, so `hardhat run --network arcTestnet` can only read
// chain state. scripts/deploy.ts refuses to broadcast anywhere but the
// in-process Hardhat network.
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 1 },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  paths: {
    sources: "src",
    tests: "test",
    cache: "cache",
    artifacts: "artifacts",
  },
  networks: {
    hardhat: { chainId: 31337, accounts: { count: 40 } },
    arcTestnet: {
      url: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: [],
    },
  },
  typechain: { outDir: "typechain-types", target: "ethers-v6" },
  gasReporter: { enabled: process.env.REPORT_GAS === "1", currency: "USD" },
  mocha: { timeout: 120_000 },
};

export default config;
