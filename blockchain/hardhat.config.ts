import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
const MAINNET_RPC = process.env.MAINNET_RPC_URL || "https://ethereum-rpc.publicnode.com";

const SHARED_DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const SEPOLIA_DEPLOYER_KEY = process.env.SEPOLIA_DEPLOYER_PRIVATE_KEY || SHARED_DEPLOYER_KEY;
const MAINNET_DEPLOYER_KEY = process.env.MAINNET_DEPLOYER_PRIVATE_KEY || SHARED_DEPLOYER_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {},
    sepolia: {
      chainId: 11155111,
      url: SEPOLIA_RPC,
      accounts: SEPOLIA_DEPLOYER_KEY ? [SEPOLIA_DEPLOYER_KEY] : [],
    },
    mainnet: {
      chainId: 1,
      url: MAINNET_RPC,
      accounts: MAINNET_DEPLOYER_KEY ? [MAINNET_DEPLOYER_KEY] : [],
    },
  },
};

export default config;
