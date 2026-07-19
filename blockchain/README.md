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

Sepolia profile (`.env` at repo root):

```
SEPOLIA_RPC_URL=https://...
SEPOLIA_DEPLOYER_PRIVATE_KEY=0x...
NEONDRAW_INITIAL_OWNER=0x...
# optional for staging, can deploy mock if unset
NEONDRAW_VRF_COORDINATOR=0x...
```

```bash
npm run validate:sepolia
npm run deploy:sepolia
```

Mainnet profile:

```
MAINNET_RPC_URL=https://...
MAINNET_DEPLOYER_PRIVATE_KEY=0x...
NEONDRAW_INITIAL_OWNER=0x...
NEONDRAW_VRF_COORDINATOR=0x...
```

```bash
npm run validate:mainnet
npm run deploy:mainnet
```

## Contract overview

- `createDraw` / `buyTicket` / `closeDraw` — draw lifecycle with time-guarded closure
- `requestDrawRandomness` — VRF request tracking
- `fulfillDraw` + `claimPrize` — claimable payout settlement with pool-cap enforcement
- `withdrawHouseRevenue` — owner withdrawal limited to non-reserved funds
- OpenZeppelin: `Ownable`, `Pausable`, `ReentrancyGuard`

## Validation commands

```bash
npm run test
npm run e2e:staging
npm run validate:mainnet
```

Legacy `../contracts/LotteryPool.sol` remains for the MVP demo path.
