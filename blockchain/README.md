# NeonDraw Blockchain

Hardhat project for `NeonDrawLottery.sol` (production lottery contract).

## Setup

```bash
cd blockchain
npm install
npm run compile
npm test
```

## Deploy

Local Hardhat network:

```bash
npm run deploy:local
```

Sepolia (requires `.env` at repo root):

```
SEPOLIA_RPC_URL=https://...
DEPLOYER_PRIVATE_KEY=0x...
```

```bash
npm run deploy:sepolia
```

## Contract overview

- `createDraw` / `buyTicket` / `closeDraw` — Phase 1 lifecycle
- `requestDrawRandomness` — Chainlink VRF hook (Phase 2)
- `fulfillDraw` + `claimPrize` — pull-payment settlement stub
- OpenZeppelin: `Ownable`, `Pausable`, `ReentrancyGuard`

Legacy `../contracts/LotteryPool.sol` remains for the MVP demo path.
