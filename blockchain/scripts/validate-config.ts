type Target = "sepolia" | "mainnet";

function readArg(): Target {
  const arg = (process.argv[2] || "").toLowerCase();
  if (arg !== "sepolia" && arg !== "mainnet") {
    throw new Error("Usage: ts-node scripts/validate-config.ts <sepolia|mainnet>");
  }
  return arg;
}

function assertUrl(name: string, value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`${name} must be http(s)`);
    }
  } catch {
    throw new Error(`${name} is invalid or missing`);
  }
}

function assertPrivateKey(name: string, value: string) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`${name} must be a 32-byte hex private key`);
  }
}

function assertAddress(name: string, value?: string) {
  if (!value) return;
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} must be a valid EVM address when provided`);
  }
}

function main() {
  const target = readArg();

  const rpc = target === "sepolia"
    ? (process.env.SEPOLIA_RPC_URL || "")
    : (process.env.MAINNET_RPC_URL || "");

  const key = target === "sepolia"
    ? (process.env.SEPOLIA_DEPLOYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || "")
    : (process.env.MAINNET_DEPLOYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || "");

  assertUrl(target === "sepolia" ? "SEPOLIA_RPC_URL" : "MAINNET_RPC_URL", rpc);
  assertPrivateKey(target === "sepolia" ? "SEPOLIA_DEPLOYER_PRIVATE_KEY|DEPLOYER_PRIVATE_KEY" : "MAINNET_DEPLOYER_PRIVATE_KEY|DEPLOYER_PRIVATE_KEY", key);
  assertAddress("NEONDRAW_INITIAL_OWNER", process.env.NEONDRAW_INITIAL_OWNER);
  assertAddress("NEONDRAW_VRF_COORDINATOR", process.env.NEONDRAW_VRF_COORDINATOR);

  if (target === "mainnet" && !process.env.NEONDRAW_VRF_COORDINATOR) {
    throw new Error("NEONDRAW_VRF_COORDINATOR is required for mainnet readiness");
  }

  console.log(`Config validation passed for ${target}.`);
}

main();
