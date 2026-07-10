// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LotteryPool (on-chain lottery escrow; deploy and set LOTTERY_CONTRACT in wallet.js)
 * @notice Production requires audit, licensing, and VRF for draws
 */
contract LotteryPool {
    address public owner;
    uint256 public ticketPrice;
    uint256 public ticketCount;
    uint256 public poolBalance;

    event TicketPurchased(
        address indexed player,
        uint8[6] numbers,
        uint256 amount,
        uint256 ticketId
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(uint256 _ticketPriceWei) {
        owner = msg.sender;
        ticketPrice = _ticketPriceWei;
    }

    function buyTicket(uint8[6] calldata numbers) external payable {
        require(msg.value >= ticketPrice, "Insufficient payment");
        for (uint256 i = 0; i < 6; i++) {
            require(numbers[i] >= 1 && numbers[i] <= 49, "Invalid number");
            for (uint256 j = i + 1; j < 6; j++) {
                require(numbers[i] != numbers[j], "Duplicate number");
            }
        }

        ticketCount++;
        poolBalance += msg.value;

        emit TicketPurchased(msg.sender, numbers, msg.value, ticketCount);
    }

    function withdrawPool(address to, uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        payable(to).transfer(amount);
        poolBalance -= amount;
    }

    receive() external payable {
        poolBalance += msg.value;
    }
}
