// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockJackpotVRF
 * @notice Test double for Chainlink VRF coordinator (Phase 2).
 */
contract MockJackpotVRF {
    uint256 public nextRequestId = 1;

    function requestRandomWords(uint256 /* drawId */) external returns (uint256 requestId) {
        requestId = nextRequestId++;
    }
}
