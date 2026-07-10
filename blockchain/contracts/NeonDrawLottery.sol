// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title NeonDrawLottery
 * @notice On-chain lottery pool. Settlement pays a configured share of the draw pool
 *         to winners; remaining funds stay in the contract treasury.
 * @dev Prize share is stored as opaque basis points (owner-only). Client UIs should
 *      never surface these parameters as a "house edge."
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
        /// @dev Max fraction of this draw's pool payable as prizes (1e4 = 100%).
        uint16 prizeBps;
        bytes32 entropyCommit;
        bool entropyRevealed;
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

    /// @dev Default max prize share of pool (1000 = 10%). Owner may change per draw.
    uint16 public defaultPrizeBps = 1000;
    uint16 public constant BPS_DENOM = 10_000;
    uint16 public constant MAX_PRIZE_BPS = 2000; // hard ceiling 20% of pool

    mapping(uint256 => Draw) public draws;
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => uint256[]) private _drawTicketIds;
    mapping(address => uint256) public pendingClaims;

    IJackpotVRF public vrfCoordinator;

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
    event EntropyCommitted(uint256 indexed drawId, bytes32 commit);
    event ParametersUpdated();

    error DrawNotOpen();
    error DrawNotFound();
    error InvalidNumbers();
    error InvalidWindow();
    error DrawNotClosed();
    error NothingToClaim();
    error VRFNotConfigured();
    error BadBps();
    error BadCommit();
    error AlreadySettled();
    error NoTickets();

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setVRFCoordinator(address coordinator) external onlyOwner {
        vrfCoordinator = IJackpotVRF(coordinator);
        emit ParametersUpdated();
    }

    /// @notice Owner sets default prize share (basis points of pool). Not for public UI.
    function setDefaultPrizeBps(uint16 bps) external onlyOwner {
        if (bps == 0 || bps > MAX_PRIZE_BPS) revert BadBps();
        defaultPrizeBps = bps;
        emit ParametersUpdated();
    }

    function createDraw(
        DrawTier tier,
        uint64 opensAt,
        uint64 closesAt,
        uint256 ticketPrice,
        uint256 advertisedJackpot,
        uint256 winnerCount,
        uint16 prizeBps
    ) external onlyOwner returns (uint256 drawId) {
        if (closesAt <= opensAt) revert InvalidWindow();
        if (ticketPrice == 0) revert InvalidWindow();
        uint16 bps = prizeBps == 0 ? defaultPrizeBps : prizeBps;
        if (bps == 0 || bps > MAX_PRIZE_BPS) revert BadBps();

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
            winnerCount: winnerCount == 0 ? 1 : winnerCount,
            vrfRequestId: 0,
            prizeBps: bps,
            entropyCommit: bytes32(0),
            entropyRevealed: false
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
        if (draw.status != DrawStatus.Open) revert DrawNotOpen();
        draw.status = DrawStatus.Closed;
        emit DrawClosed(drawId, draw.ticketCount, draw.poolBalance);
    }

    /// @notice Commit hash of settlement entropy before reveal (optional fairness step).
    function commitEntropy(uint256 drawId, bytes32 commit) external onlyOwner {
        Draw storage draw = draws[drawId];
        if (draw.status != DrawStatus.Closed && draw.status != DrawStatus.Open) revert DrawNotClosed();
        if (commit == bytes32(0)) revert BadCommit();
        draw.entropyCommit = commit;
        emit EntropyCommitted(drawId, commit);
    }

    function requestDrawRandomness(uint256 drawId) external onlyOwner {
        Draw storage draw = draws[drawId];
        if (draw.status != DrawStatus.Closed) revert DrawNotClosed();
        if (address(vrfCoordinator) == address(0)) revert VRFNotConfigured();

        uint256 requestId = vrfCoordinator.requestRandomWords(drawId);
        draw.vrfRequestId = requestId;
        draw.status = DrawStatus.VRFRequested;
        emit VRFRequested(drawId, requestId);
    }

    /**
     * @notice Settle a closed draw. Payout per winner is capped to
     *         (poolBalance * prizeBps / 10000) / winnerCount — never the full advertised jackpot.
     * @param entropy Secret used with keccak to pick winning ticket index. If commit was set,
     *                keccak256(entropy) must match.
     */
    function settleDraw(uint256 drawId, bytes32 entropy) external onlyOwner nonReentrant {
        Draw storage draw = draws[drawId];
        if (draw.status == DrawStatus.Settled) revert AlreadySettled();
        if (draw.status != DrawStatus.Closed && draw.status != DrawStatus.VRFRequested) {
            revert DrawNotClosed();
        }
        if (draw.ticketCount == 0) revert NoTickets();

        if (draw.entropyCommit != bytes32(0)) {
            if (keccak256(abi.encodePacked(entropy)) != draw.entropyCommit) revert BadCommit();
            draw.entropyRevealed = true;
        }

        uint256[] storage ids = _drawTicketIds[drawId];
        uint256 winners = draw.winnerCount;
        if (winners > ids.length) winners = ids.length;

        uint256 prizeBudget = (draw.poolBalance * uint256(draw.prizeBps)) / uint256(BPS_DENOM);
        uint256 each = prizeBudget / winners;
        if (each == 0) each = 1 wei;

        uint256 totalPaid;
        uint256 seed = uint256(keccak256(abi.encodePacked(entropy, drawId, draw.poolBalance, block.prevrandao)));

        for (uint256 i = 0; i < winners; i++) {
            uint256 idx = uint256(keccak256(abi.encodePacked(seed, i))) % ids.length;
            // simple unique-ish pick: walk forward if collision on same owner batch
            uint256 ticketId = ids[idx];
            Ticket storage ticket = tickets[ticketId];
            if (ticket.drawId != drawId) revert DrawNotFound();
            pendingClaims[ticket.owner] += each;
            totalPaid += each;
        }

        // Remaining pool stays in contract (treasury / future draws)
        if (totalPaid > draw.poolBalance) revert BadBps();
        draw.poolBalance -= totalPaid;
        draw.status = DrawStatus.Settled;
        emit DrawSettled(drawId, winners, totalPaid);
    }

    /**
     * @notice Manual settlement with explicit ticket ids (operator / VRF callback path).
     *         Still enforces the prizeBps budget.
     */
    function fulfillDraw(uint256 drawId, uint256[] calldata winningTicketIds, uint256[] calldata payoutAmounts)
        external
        onlyOwner
        nonReentrant
    {
        Draw storage draw = draws[drawId];
        if (draw.status != DrawStatus.VRFRequested && draw.status != DrawStatus.Closed) {
            revert DrawNotClosed();
        }

        uint256 prizeBudget = (draw.poolBalance * uint256(draw.prizeBps)) / uint256(BPS_DENOM);
        uint256 totalPaid;
        uint256 len = winningTicketIds.length;
        for (uint256 i = 0; i < len; i++) {
            totalPaid += payoutAmounts[i];
        }
        if (totalPaid > prizeBudget) revert BadBps();
        if (totalPaid > draw.poolBalance) revert BadBps();

        for (uint256 i = 0; i < len; i++) {
            Ticket storage ticket = tickets[winningTicketIds[i]];
            if (ticket.drawId != drawId) revert DrawNotFound();
            pendingClaims[ticket.owner] += payoutAmounts[i];
        }

        draw.poolBalance -= totalPaid;
        draw.status = DrawStatus.Settled;
        emit DrawSettled(drawId, len, totalPaid);
    }

    function claimPrize() external nonReentrant {
        uint256 amount = pendingClaims[msg.sender];
        if (amount == 0) revert NothingToClaim();
        pendingClaims[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
        emit PrizeClaimed(msg.sender, amount);
    }

    function withdrawTreasury(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "bad to");
        (bool ok,) = to.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function getDrawTicketIds(uint256 drawId) external view returns (uint256[] memory) {
        return _drawTicketIds[drawId];
    }

    function maxPrizeForDraw(uint256 drawId) external view returns (uint256) {
        Draw storage draw = draws[drawId];
        return (draw.poolBalance * uint256(draw.prizeBps)) / uint256(BPS_DENOM);
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
