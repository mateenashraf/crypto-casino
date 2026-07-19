// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title NeonDrawLottery
 * @notice Production lottery contract skeleton. VRF settlement is stubbed for Phase 2.
 */
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IJackpotVRF {
    function requestRandomWords(uint256 drawId) external returns (uint256 requestId);
}

contract NeonDrawLottery is Ownable, Pausable, ReentrancyGuard {
    enum DrawTier {
        Daily,
        Weekly,
        Monthly,
        Quarterly
    }

    enum DrawStatus {
        Open,
        Closed,
        VRFRequested,
        Settled,
        Cancelled
    }

    struct Draw {
        DrawTier tier;
        DrawStatus status;
        uint64 opensAt;
        uint64 closesAt;
        uint256 ticketPrice;
        uint256 advertisedJackpot;
        uint256 poolBalance;
        uint256 ticketCount;
        uint256 winnerCount;
        uint256 vrfRequestId;
    }

    struct Ticket {
        uint256 drawId;
        address owner;
        uint8[6] numbers;
        uint64 purchasedAt;
        bool claimed;
    }

    uint256 public nextDrawId = 1;
    uint256 public nextTicketId = 1;

    mapping(uint256 => Draw) public draws;
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => uint256[]) private _drawTicketIds;
    mapping(address => uint256) public pendingClaims;
    mapping(uint256 => uint256) public drawByVrfRequestId;

    IJackpotVRF public vrfCoordinator;
    uint256 public totalReservedClaims;

    event DrawCreated(
        uint256 indexed drawId,
        DrawTier tier,
        uint64 opensAt,
        uint64 closesAt,
        uint256 ticketPrice,
        uint256 advertisedJackpot
    );
    event TicketPurchased(
        uint256 indexed ticketId,
        uint256 indexed drawId,
        address indexed buyer,
        uint8[6] numbers,
        uint256 amountPaid
    );
    event DrawClosed(uint256 indexed drawId, uint256 ticketCount, uint256 poolBalance);
    event VRFRequested(uint256 indexed drawId, uint256 requestId);
    event DrawSettled(uint256 indexed drawId, uint256 winnerCount, uint256 totalPaid);
    event PrizeClaimed(address indexed winner, uint256 amount);
    event HouseRevenueWithdrawn(address indexed to, uint256 amount);

    error DrawNotOpen();
    error DrawNotFound();
    error InvalidNumbers();
    error InvalidWindow();
    error DrawNotClosed();
    error NothingToClaim();
    error VRFNotConfigured();
    error InvalidDrawState();
    error InvalidPayoutInput();
    error PayoutExceedsPool();
    error InsufficientAvailableBalance();

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setVRFCoordinator(address coordinator) external onlyOwner {
        vrfCoordinator = IJackpotVRF(coordinator);
    }

    function createDraw(
        DrawTier tier,
        uint64 opensAt,
        uint64 closesAt,
        uint256 ticketPrice,
        uint256 advertisedJackpot,
        uint256 winnerCount
    ) external onlyOwner returns (uint256 drawId) {
        if (closesAt <= opensAt) revert InvalidWindow();
        if (ticketPrice == 0) revert InvalidWindow();

        drawId = nextDrawId++;
        draws[drawId] = Draw({
            tier: tier,
            status: DrawStatus.Open,
            opensAt: opensAt,
            closesAt: closesAt,
            ticketPrice: ticketPrice,
            advertisedJackpot: advertisedJackpot,
            poolBalance: 0,
            ticketCount: 0,
            winnerCount: winnerCount,
            vrfRequestId: 0
        });

        emit DrawCreated(drawId, tier, opensAt, closesAt, ticketPrice, advertisedJackpot);
    }

    function buyTicket(uint256 drawId, uint8[6] calldata numbers) external payable whenNotPaused nonReentrant {
        Draw storage draw = draws[drawId];
        if (draw.opensAt == 0 && draw.closesAt == 0) revert DrawNotFound();
        if (draw.status != DrawStatus.Open) revert DrawNotOpen();
        if (block.timestamp < draw.opensAt || block.timestamp >= draw.closesAt) revert DrawNotOpen();
        if (msg.value != draw.ticketPrice) revert DrawNotOpen();
        _validateNumbers(numbers);

        uint256 ticketId = nextTicketId++;
        tickets[ticketId] = Ticket({
            drawId: drawId,
            owner: msg.sender,
            numbers: numbers,
            purchasedAt: uint64(block.timestamp),
            claimed: false
        });

        _drawTicketIds[drawId].push(ticketId);
        draw.ticketCount += 1;
        draw.poolBalance += msg.value;

        emit TicketPurchased(ticketId, drawId, msg.sender, numbers, msg.value);
    }

    function closeDraw(uint256 drawId) external onlyOwner {
        Draw storage draw = draws[drawId];
        if (draw.opensAt == 0 && draw.closesAt == 0) revert DrawNotFound();
        if (draw.status != DrawStatus.Open) revert DrawNotOpen();
        if (block.timestamp < draw.closesAt) revert InvalidDrawState();

        draw.status = DrawStatus.Closed;
        emit DrawClosed(drawId, draw.ticketCount, draw.poolBalance);
    }

    function requestDrawRandomness(uint256 drawId) external onlyOwner {
        Draw storage draw = draws[drawId];
        if (draw.opensAt == 0 && draw.closesAt == 0) revert DrawNotFound();
        if (draw.status != DrawStatus.Closed) revert DrawNotClosed();
        if (address(vrfCoordinator) == address(0)) revert VRFNotConfigured();

        uint256 requestId = vrfCoordinator.requestRandomWords(drawId);
        draw.vrfRequestId = requestId;
        drawByVrfRequestId[requestId] = drawId;
        draw.status = DrawStatus.VRFRequested;
        emit VRFRequested(drawId, requestId);
    }

    /**
     * @notice Owner-triggered settlement with externally computed winners/payouts.
     * @dev In production, call this after VRF has produced winning data off-chain and been verified operationally.
     */
    function fulfillDraw(uint256 drawId, uint256[] calldata winningTicketIds, uint256[] calldata payoutAmounts)
        external
        onlyOwner
    {
        Draw storage draw = draws[drawId];
        if (draw.opensAt == 0 && draw.closesAt == 0) revert DrawNotFound();
        if (draw.status != DrawStatus.VRFRequested) revert InvalidDrawState();

        uint256 len = winningTicketIds.length;
        if (len != payoutAmounts.length) revert InvalidPayoutInput();
        if (draw.winnerCount > 0 && len > draw.winnerCount) revert InvalidPayoutInput();

        uint256 totalPaid;
        for (uint256 i = 0; i < len; i++) {
            uint256 ticketId = winningTicketIds[i];
            uint256 payout = payoutAmounts[i];
            if (payout == 0) revert InvalidPayoutInput();

            Ticket storage ticket = tickets[ticketId];
            if (ticket.drawId != drawId) revert DrawNotFound();

            for (uint256 j = 0; j < i; j++) {
                if (winningTicketIds[j] == ticketId) revert InvalidPayoutInput();
            }

            pendingClaims[ticket.owner] += payout;
            totalPaid += payout;
        }

        if (totalPaid > draw.poolBalance) revert PayoutExceedsPool();

        draw.poolBalance -= totalPaid;
        totalReservedClaims += totalPaid;
        draw.status = DrawStatus.Settled;
        emit DrawSettled(drawId, len, totalPaid);
    }

    function claimPrize() external nonReentrant {
        uint256 amount = pendingClaims[msg.sender];
        if (amount == 0) revert NothingToClaim();

        pendingClaims[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");

        totalReservedClaims -= amount;
        emit PrizeClaimed(msg.sender, amount);
    }

    function withdrawHouseRevenue(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0) || amount == 0) revert InvalidPayoutInput();

        uint256 available = address(this).balance - totalReservedClaims;
        if (amount > available) revert InsufficientAvailableBalance();

        (bool ok,) = to.call{value: amount}("");
        require(ok, "Transfer failed");
        emit HouseRevenueWithdrawn(to, amount);
    }

    function getDrawTicketIds(uint256 drawId) external view returns (uint256[] memory) {
        return _drawTicketIds[drawId];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _validateNumbers(uint8[6] calldata numbers) internal pure {
        for (uint256 i = 0; i < 6; i++) {
            if (numbers[i] < 1 || numbers[i] > 49) revert InvalidNumbers();
        }
        for (uint256 i = 0; i < 6; i++) {
            for (uint256 j = i + 1; j < 6; j++) {
                if (numbers[i] == numbers[j]) revert InvalidNumbers();
            }
        }
    }
}
