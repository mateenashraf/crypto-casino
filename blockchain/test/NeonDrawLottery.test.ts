// @ts-nocheck
import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("NeonDrawLottery", function () {
  // ── shared fixture ──────────────────────────────────────────────────
  async function deployFixture() {
    const [owner, player, player2] = await ethers.getSigners();
    const lottery = await ethers.deployContract("NeonDrawLottery", [owner.address]);
    const mockVRF = await ethers.deployContract("MockJackpotVRF");
    const now = await time.latest();
    const opensAt = now + 60;
    const closesAt = now + 86400;
    const ticketPrice = ethers.parseEther("0.001");

    await lottery.createDraw(0, opensAt, closesAt, ticketPrice, ethers.parseEther("100"), 3);
    return { lottery, mockVRF, owner, player, player2, ticketPrice, opensAt, closesAt };
  }

  // ── createDraw ──────────────────────────────────────────────────────
  describe("createDraw", function () {
    it("creates a draw and emits DrawCreated", async function () {
      const { lottery, owner, ticketPrice } = await loadFixture(deployFixture);
      const now = await time.latest();
      await expect(lottery.createDraw(1, now + 10, now + 500, ticketPrice, 0, 1))
        .to.emit(lottery, "DrawCreated");
    });

    it("increments nextDrawId", async function () {
      const { lottery } = await loadFixture(deployFixture);
      expect(await lottery.nextDrawId()).to.equal(2); // fixture already created draw 1
    });

    it("reverts if closesAt <= opensAt", async function () {
      const { lottery } = await loadFixture(deployFixture);
      const now = await time.latest();
      await expect(
        lottery.createDraw(0, now + 100, now + 50, ethers.parseEther("0.001"), 0, 1)
      ).to.be.revertedWithCustomError(lottery, "InvalidWindow");
    });

    it("reverts if ticketPrice is zero", async function () {
      const { lottery } = await loadFixture(deployFixture);
      const now = await time.latest();
      await expect(
        lottery.createDraw(0, now + 10, now + 500, 0, 0, 1)
      ).to.be.revertedWithCustomError(lottery, "InvalidWindow");
    });

    it("reverts if called by non-owner", async function () {
      const { lottery, player } = await loadFixture(deployFixture);
      const now = await time.latest();
      await expect(
        lottery.connect(player).createDraw(0, now + 10, now + 500, ethers.parseEther("0.001"), 0, 1)
      ).to.be.revertedWithCustomError(lottery, "OwnableUnauthorizedAccount");
    });
  });

  // ── buyTicket ───────────────────────────────────────────────────────
  describe("buyTicket", function () {
    it("sells a ticket and emits TicketPurchased", async function () {
      const { lottery, player, ticketPrice, opensAt } = await loadFixture(deployFixture);
      await time.increaseTo(opensAt + 1);

      const numbers = [1, 2, 3, 4, 5, 6] as const;
      await expect(lottery.connect(player).buyTicket(1, numbers, { value: ticketPrice }))
        .to.emit(lottery, "TicketPurchased")
        .withArgs(1, 1, player.address, numbers, ticketPrice);

      const draw = await lottery.draws(1);
      expect(draw.ticketCount).to.equal(1);
      expect(draw.poolBalance).to.equal(ticketPrice);
    });

    it("increments nextTicketId across multiple purchases", async function () {
      const { lottery, player, player2, ticketPrice, opensAt } = await loadFixture(deployFixture);
      await time.increaseTo(opensAt + 1);

      await lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 6], { value: ticketPrice });
      await lottery.connect(player2).buyTicket(1, [7, 8, 9, 10, 11, 12], { value: ticketPrice });
      expect(await lottery.nextTicketId()).to.equal(3);
    });

    it("accumulates pool balance from multiple tickets", async function () {
      const { lottery, player, player2, ticketPrice, opensAt } = await loadFixture(deployFixture);
      await time.increaseTo(opensAt + 1);

      await lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 6], { value: ticketPrice });
      await lottery.connect(player2).buyTicket(1, [7, 8, 9, 10, 11, 12], { value: ticketPrice });

      const draw = await lottery.draws(1);
      expect(draw.ticketCount).to.equal(2);
      expect(draw.poolBalance).to.equal(ticketPrice * 2n);
    });

    it("rejects duplicate numbers", async function () {
      const { lottery, player, ticketPrice, opensAt } = await loadFixture(deployFixture);
      await time.increaseTo(opensAt + 1);

      await expect(
        lottery.connect(player).buyTicket(1, [1, 1, 3, 4, 5, 6], { value: ticketPrice })
      ).to.be.revertedWithCustomError(lottery, "InvalidNumbers");
    });

    it("rejects numbers out of range (0)", async function () {
      const { lottery, player, ticketPrice, opensAt } = await loadFixture(deployFixture);
      await time.increaseTo(opensAt + 1);

      await expect(
        lottery.connect(player).buyTicket(1, [0, 2, 3, 4, 5, 6], { value: ticketPrice })
      ).to.be.revertedWithCustomError(lottery, "InvalidNumbers");
    });

    it("rejects numbers out of range (50)", async function () {
      const { lottery, player, ticketPrice, opensAt } = await loadFixture(deployFixture);
      await time.increaseTo(opensAt + 1);

      await expect(
        lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 50], { value: ticketPrice })
      ).to.be.revertedWithCustomError(lottery, "InvalidNumbers");
    });

    it("rejects wrong payment amount", async function () {
      const { lottery, player, opensAt } = await loadFixture(deployFixture);
      await time.increaseTo(opensAt + 1);

      await expect(
        lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 6], { value: ethers.parseEther("0.002") })
      ).to.be.revertedWithCustomError(lottery, "DrawNotOpen");
    });

    it("rejects purchase before draw opens", async function () {
      const { lottery, player, ticketPrice } = await loadFixture(deployFixture);
      // don't advance time — still before opensAt

      await expect(
        lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 6], { value: ticketPrice })
      ).to.be.revertedWithCustomError(lottery, "DrawNotOpen");
    });

    it("rejects purchase after draw closes", async function () {
      const { lottery, player, ticketPrice, closesAt } = await loadFixture(deployFixture);
      await time.increaseTo(closesAt + 1);

      await expect(
        lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 6], { value: ticketPrice })
      ).to.be.revertedWithCustomError(lottery, "DrawNotOpen");
    });

    it("rejects purchase for non-existent draw", async function () {
      const { lottery, player, ticketPrice, opensAt } = await loadFixture(deployFixture);
      await time.increaseTo(opensAt + 1);

      await expect(
        lottery.connect(player).buyTicket(999, [1, 2, 3, 4, 5, 6], { value: ticketPrice })
      ).to.be.revertedWithCustomError(lottery, "DrawNotFound");
    });

    it("rejects purchase on a closed draw", async function () {
      const { lottery, owner, player, ticketPrice, closesAt } = await loadFixture(deployFixture);
      await time.increaseTo(closesAt + 1);
      await lottery.connect(owner).closeDraw(1);

      await expect(
        lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 6], { value: ticketPrice })
      ).to.be.revertedWithCustomError(lottery, "DrawNotOpen");
    });
  });

  // ── closeDraw ───────────────────────────────────────────────────────
  describe("closeDraw", function () {
    it("closes an open draw and emits DrawClosed", async function () {
      const { lottery, closesAt } = await loadFixture(deployFixture);
      await time.increaseTo(closesAt + 1);

      await expect(lottery.closeDraw(1)).to.emit(lottery, "DrawClosed");
      const draw = await lottery.draws(1);
      expect(draw.status).to.equal(1); // Closed
    });

    it("reverts if draw is already closed", async function () {
      const { lottery, closesAt } = await loadFixture(deployFixture);
      await time.increaseTo(closesAt + 1);
      await lottery.closeDraw(1);

      await expect(lottery.closeDraw(1))
        .to.be.revertedWithCustomError(lottery, "DrawNotOpen");
    });

    it("reverts if close is attempted before closesAt", async function () {
      const { lottery, opensAt } = await loadFixture(deployFixture);
      await time.increaseTo(opensAt + 1);

      await expect(lottery.closeDraw(1))
        .to.be.revertedWithCustomError(lottery, "InvalidDrawState");
    });

    it("reverts if called by non-owner", async function () {
      const { lottery, player, closesAt } = await loadFixture(deployFixture);
      await time.increaseTo(closesAt + 1);

      await expect(lottery.connect(player).closeDraw(1))
        .to.be.revertedWithCustomError(lottery, "OwnableUnauthorizedAccount");
    });
  });

  // ── pause / unpause ─────────────────────────────────────────────────
  describe("pause / unpause", function () {
    it("owner can pause and block ticket purchases", async function () {
      const { lottery, player, ticketPrice, opensAt } = await loadFixture(deployFixture);
      await time.increaseTo(opensAt + 1);
      await lottery.pause();

      await expect(
        lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 6], { value: ticketPrice })
      ).to.be.revertedWithCustomError(lottery, "EnforcedPause");
    });

    it("owner can unpause and allow purchases again", async function () {
      const { lottery, player, ticketPrice, opensAt } = await loadFixture(deployFixture);
      await time.increaseTo(opensAt + 1);
      await lottery.pause();
      await lottery.unpause();

      await expect(
        lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 6], { value: ticketPrice })
      ).to.emit(lottery, "TicketPurchased");
    });

    it("non-owner cannot pause", async function () {
      const { lottery, player } = await loadFixture(deployFixture);
      await expect(lottery.connect(player).pause())
        .to.be.revertedWithCustomError(lottery, "OwnableUnauthorizedAccount");
    });

    it("non-owner cannot unpause", async function () {
      const { lottery, player } = await loadFixture(deployFixture);
      await lottery.pause();
      await expect(lottery.connect(player).unpause())
        .to.be.revertedWithCustomError(lottery, "OwnableUnauthorizedAccount");
    });
  });

  // ── setVRFCoordinator ───────────────────────────────────────────────
  describe("setVRFCoordinator", function () {
    it("owner can set VRF coordinator", async function () {
      const { lottery, mockVRF } = await loadFixture(deployFixture);
      await lottery.setVRFCoordinator(await mockVRF.getAddress());
      expect(await lottery.vrfCoordinator()).to.equal(await mockVRF.getAddress());
    });

    it("non-owner cannot set VRF coordinator", async function () {
      const { lottery, mockVRF, player } = await loadFixture(deployFixture);
      await expect(
        lottery.connect(player).setVRFCoordinator(await mockVRF.getAddress())
      ).to.be.revertedWithCustomError(lottery, "OwnableUnauthorizedAccount");
    });
  });

  // ── requestDrawRandomness ───────────────────────────────────────────
  describe("requestDrawRandomness", function () {
    it("requests randomness for a closed draw", async function () {
      const { lottery, mockVRF, closesAt } = await loadFixture(deployFixture);
      await lottery.setVRFCoordinator(await mockVRF.getAddress());
      await time.increaseTo(closesAt + 1);
      await lottery.closeDraw(1);

      await expect(lottery.requestDrawRandomness(1))
        .to.emit(lottery, "VRFRequested");

      const draw = await lottery.draws(1);
      expect(draw.status).to.equal(2); // VRFRequested
      expect(draw.vrfRequestId).to.equal(1);
    });

    it("reverts if draw is not closed", async function () {
      const { lottery, mockVRF, opensAt } = await loadFixture(deployFixture);
      await lottery.setVRFCoordinator(await mockVRF.getAddress());
      await time.increaseTo(opensAt + 1);

      await expect(lottery.requestDrawRandomness(1))
        .to.be.revertedWithCustomError(lottery, "DrawNotClosed");
    });

    it("reverts if VRF coordinator is not set", async function () {
      const { lottery, closesAt } = await loadFixture(deployFixture);
      await time.increaseTo(closesAt + 1);
      await lottery.closeDraw(1);

      await expect(lottery.requestDrawRandomness(1))
        .to.be.revertedWithCustomError(lottery, "VRFNotConfigured");
    });

    it("reverts if called by non-owner", async function () {
      const { lottery, mockVRF, player, closesAt } = await loadFixture(deployFixture);
      await lottery.setVRFCoordinator(await mockVRF.getAddress());
      await time.increaseTo(closesAt + 1);
      await lottery.closeDraw(1);

      await expect(lottery.connect(player).requestDrawRandomness(1))
        .to.be.revertedWithCustomError(lottery, "OwnableUnauthorizedAccount");
    });
  });

  // ── fulfillDraw ─────────────────────────────────────────────────────
  describe("fulfillDraw", function () {
    async function settledFixture() {
      const { lottery, mockVRF, owner, player, player2, ticketPrice, opensAt, closesAt } = await loadFixture(deployFixture);
      await lottery.setVRFCoordinator(await mockVRF.getAddress());
      await time.increaseTo(opensAt + 1);

      await lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 6], { value: ticketPrice });
      await lottery.connect(player2).buyTicket(1, [7, 8, 9, 10, 11, 12], { value: ticketPrice });

      await time.increaseTo(closesAt + 1);
      await lottery.closeDraw(1);
      await lottery.requestDrawRandomness(1);

      return { lottery, owner, player, player2, ticketPrice };
    }

    it("settles a draw and credits winners", async function () {
      const { lottery, player, ticketPrice } = await settledFixture();
      const payout = ticketPrice;

      await expect(lottery.fulfillDraw(1, [1], [payout]))
        .to.emit(lottery, "DrawSettled")
        .withArgs(1, 1, payout);

      expect(await lottery.pendingClaims(player.address)).to.equal(payout);
      const draw = await lottery.draws(1);
      expect(draw.status).to.equal(3); // Settled
    });

    it("credits multiple winners", async function () {
      const { lottery, player, player2, ticketPrice } = await settledFixture();
      const payout = ticketPrice / 2n;

      await lottery.fulfillDraw(1, [1, 2], [payout, payout]);
      expect(await lottery.pendingClaims(player.address)).to.equal(payout);
      expect(await lottery.pendingClaims(player2.address)).to.equal(payout);
    });

    it("reverts if ticket does not belong to draw", async function () {
      const { lottery } = await settledFixture();
      await expect(
        lottery.fulfillDraw(1, [999], [1000])
      ).to.be.revertedWithCustomError(lottery, "DrawNotFound");
    });

    it("reverts if called by non-owner", async function () {
      const { lottery, player, ticketPrice } = await settledFixture();
      await expect(
        lottery.connect(player).fulfillDraw(1, [1], [ticketPrice])
      ).to.be.revertedWithCustomError(lottery, "OwnableUnauthorizedAccount");
    });

    it("reverts on payout length mismatch", async function () {
      const { lottery, ticketPrice } = await settledFixture();
      await expect(
        lottery.fulfillDraw(1, [1, 2], [ticketPrice])
      ).to.be.revertedWithCustomError(lottery, "InvalidPayoutInput");
    });

    it("reverts on duplicate winning ticket ids", async function () {
      const { lottery, ticketPrice } = await settledFixture();
      await expect(
        lottery.fulfillDraw(1, [1, 1], [ticketPrice, ticketPrice])
      ).to.be.revertedWithCustomError(lottery, "InvalidPayoutInput");
    });

    it("reverts when payouts exceed draw pool", async function () {
      const { lottery, ticketPrice } = await settledFixture();
      await expect(
        lottery.fulfillDraw(1, [1], [ticketPrice * 3n])
      ).to.be.revertedWithCustomError(lottery, "PayoutExceedsPool");
    });
  });

  // ── claimPrize ──────────────────────────────────────────────────────
  describe("claimPrize", function () {
    it("pays out pending claims to winner", async function () {
      const { lottery, mockVRF, player, ticketPrice, opensAt, closesAt } = await loadFixture(deployFixture);
      await lottery.setVRFCoordinator(await mockVRF.getAddress());
      await time.increaseTo(opensAt + 1);

      await lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 6], { value: ticketPrice });
      await time.increaseTo(closesAt + 1);
      await lottery.closeDraw(1);
      await lottery.requestDrawRandomness(1);
      await lottery.fulfillDraw(1, [1], [ticketPrice]);

      const balBefore = await ethers.provider.getBalance(player.address);
      const tx = await lottery.connect(player).claimPrize();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(player.address);

      expect(balAfter + gasUsed - balBefore).to.equal(ticketPrice);
      expect(await lottery.pendingClaims(player.address)).to.equal(0);
    });

    it("emits PrizeClaimed", async function () {
      const { lottery, mockVRF, player, ticketPrice, opensAt, closesAt } = await loadFixture(deployFixture);
      await lottery.setVRFCoordinator(await mockVRF.getAddress());
      await time.increaseTo(opensAt + 1);

      await lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 6], { value: ticketPrice });
      await time.increaseTo(closesAt + 1);
      await lottery.closeDraw(1);
      await lottery.requestDrawRandomness(1);
      await lottery.fulfillDraw(1, [1], [ticketPrice]);

      await expect(lottery.connect(player).claimPrize())
        .to.emit(lottery, "PrizeClaimed")
        .withArgs(player.address, ticketPrice);
    });

    it("reverts if nothing to claim", async function () {
      const { lottery, player } = await loadFixture(deployFixture);
      await expect(lottery.connect(player).claimPrize())
        .to.be.revertedWithCustomError(lottery, "NothingToClaim");
    });
  });

  describe("withdrawHouseRevenue", function () {
    it("allows owner to withdraw only non-reserved funds", async function () {
      const { lottery, mockVRF, owner, player, ticketPrice, opensAt, closesAt } = await loadFixture(deployFixture);
      await lottery.setVRFCoordinator(await mockVRF.getAddress());
      await time.increaseTo(opensAt + 1);

      await lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 6], { value: ticketPrice });
      await time.increaseTo(closesAt + 1);
      await lottery.closeDraw(1);
      await lottery.requestDrawRandomness(1);
      await lottery.fulfillDraw(1, [1], [ticketPrice / 2n]);

      await expect(
        lottery.withdrawHouseRevenue(owner.address, ticketPrice)
      ).to.be.revertedWithCustomError(lottery, "InsufficientAvailableBalance");

      await expect(
        lottery.withdrawHouseRevenue(owner.address, ticketPrice / 2n)
      ).to.emit(lottery, "HouseRevenueWithdrawn");
    });
  });

  // ── getDrawTicketIds ────────────────────────────────────────────────
  describe("getDrawTicketIds", function () {
    it("returns ticket IDs for a draw", async function () {
      const { lottery, player, player2, ticketPrice, opensAt } = await loadFixture(deployFixture);
      await time.increaseTo(opensAt + 1);

      await lottery.connect(player).buyTicket(1, [1, 2, 3, 4, 5, 6], { value: ticketPrice });
      await lottery.connect(player2).buyTicket(1, [7, 8, 9, 10, 11, 12], { value: ticketPrice });

      const ids = await lottery.getDrawTicketIds(1);
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(1);
      expect(ids[1]).to.equal(2);
    });

    it("returns empty array for draw with no tickets", async function () {
      const { lottery } = await loadFixture(deployFixture);
      const ids = await lottery.getDrawTicketIds(1);
      expect(ids.length).to.equal(0);
    });
  });

  // ── full lifecycle ──────────────────────────────────────────────────
  describe("full lifecycle (end-to-end)", function () {
    it("create → buy → close → VRF → settle → claim", async function () {
      const { lottery, mockVRF, owner, player, ticketPrice, opensAt, closesAt } = await loadFixture(deployFixture);
      await lottery.setVRFCoordinator(await mockVRF.getAddress());
      await time.increaseTo(opensAt + 1);

      // buy ticket
      await lottery.connect(player).buyTicket(1, [10, 20, 30, 40, 41, 49], { value: ticketPrice });

      // close draw
      await time.increaseTo(closesAt + 1);
      await lottery.closeDraw(1);
      const drawAfterClose = await lottery.draws(1);
      expect(drawAfterClose.status).to.equal(1);

      // request VRF
      await lottery.requestDrawRandomness(1);
      const drawAfterVRF = await lottery.draws(1);
      expect(drawAfterVRF.status).to.equal(2);

      // settle
      await lottery.fulfillDraw(1, [1], [ticketPrice]);
      const drawAfterSettle = await lottery.draws(1);
      expect(drawAfterSettle.status).to.equal(3);

      // claim
      await expect(lottery.connect(player).claimPrize())
        .to.emit(lottery, "PrizeClaimed");
    });
  });
});
