import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("NeonDrawLottery", function () {
  async function deployFixture() {
    const [owner, player] = await ethers.getSigners();
    const lottery = await ethers.deployContract("NeonDrawLottery", [owner.address]);
    const now = await time.latest();
    const opensAt = now + 60;
    const closesAt = now + 86400;
    const ticketPrice = ethers.parseEther("0.001");

    await lottery.createDraw(0, opensAt, closesAt, ticketPrice, ethers.parseEther("100"), 3, 0);
    return { lottery, owner, player, ticketPrice, opensAt };
  }

  it("creates a draw and sells a ticket", async function () {
    const { lottery, player, ticketPrice, opensAt } = await deployFixture();
    await time.increaseTo(opensAt + 1);

    const numbers = [1, 2, 3, 4, 5, 6] as const;
    await expect(lottery.connect(player).buyTicket(1, numbers, { value: ticketPrice }))
      .to.emit(lottery, "TicketPurchased")
      .withArgs(1, 1, player.address, numbers, ticketPrice);

    const draw = await lottery.draws(1);
    expect(draw.ticketCount).to.equal(1);
    expect(draw.poolBalance).to.equal(ticketPrice);
  });

  it("rejects duplicate numbers", async function () {
    const { lottery, player, ticketPrice, opensAt } = await deployFixture();
    await time.increaseTo(opensAt + 1);

    await expect(
      lottery.connect(player).buyTicket(1, [1, 1, 3, 4, 5, 6], { value: ticketPrice })
    ).to.be.revertedWithCustomError(lottery, "InvalidNumbers");
  });
});
