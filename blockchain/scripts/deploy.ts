import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const lottery = await ethers.deployContract("NeonDrawLottery", [deployer.address]);
  await lottery.waitForDeployment();
  console.log("NeonDrawLottery:", await lottery.getAddress());

  const mockVrf = await ethers.deployContract("MockJackpotVRF");
  await mockVrf.waitForDeployment();
  console.log("MockJackpotVRF:", await mockVrf.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
