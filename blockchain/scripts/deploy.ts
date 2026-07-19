// @ts-nocheck
const hh = require("hardhat");
const ethers = hh.ethers;
const network = hh.network;

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const profile = network.name;
  const initialOwner = process.env.NEONDRAW_INITIAL_OWNER || deployer.address;

  console.log(`Deploy profile: ${profile}`);
  console.log("Deployer:", deployer.address);
  console.log("Initial owner:", initialOwner);

  const lottery = await ethers.deployContract("NeonDrawLottery", [initialOwner]);
  await lottery.waitForDeployment();
  const lotteryAddress = await lottery.getAddress();
  console.log("NeonDrawLottery:", lotteryAddress);

  const configuredVrf = process.env.NEONDRAW_VRF_COORDINATOR;
  const deployMockByDefault = profile === "hardhat" || profile === "localhost";
  const shouldDeployMockVrf = boolEnv("NEONDRAW_DEPLOY_MOCK_VRF", deployMockByDefault);

  let vrfAddress = configuredVrf || "";
  if (!vrfAddress && shouldDeployMockVrf) {
    const mockVrf = await ethers.deployContract("MockJackpotVRF");
    await mockVrf.waitForDeployment();
    vrfAddress = await mockVrf.getAddress();
    console.log("MockJackpotVRF:", vrfAddress);
  }

  if (vrfAddress) {
    const tx = await lottery.setVRFCoordinator(vrfAddress);
    await tx.wait();
    console.log("VRF coordinator set:", vrfAddress);
  }

  console.log("Deployment summary:");
  console.log(JSON.stringify({
    network: profile,
    lottery: lotteryAddress,
    vrfCoordinator: vrfAddress || null,
    owner: initialOwner,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
