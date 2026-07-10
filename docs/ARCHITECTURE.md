# NeonDraw Production Architecture

This document describes the migration from the static MVP to a production-ready, real-money blockchain lottery platform.

## Principles

1. **Never big-bang rewrite** - the existing static site keeps working until each slice is production-ready.
2. **Chain is authoritative for money and draws** - randomness, payouts, and ticket ownership live on-chain (Chainlink VRF in Phase 2).
3. **Backend is authoritative for history and compliance** - PostgreSQL indexes chain events; localStorage is cache-only.
4. **Frontend is a wallet + display layer** - no `Math.random()` for winners.

## Current MVP (legacy)

```
index.html + js/*  →  localStorage  →  optional ETH → Treasury / LotteryPool.sol
```

See [README](../README.md) for the demo app. Draw execution lives in `js/draw-engine.js` (client-side).

## Target system

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Next.js (TBD)  │────▶│  ASP.NET Core 9  │────▶│   PostgreSQL    │
│  Wagmi/Rainbow  │     │  SignalR/Hangfire│     │   Redis         │
└────────┬────────┘     └────────┬─────────┘     └─────────────────┘
         │                       │
         │                       │ index events
         ▼                       ▼
┌────────────────────────────────────────────────────────────────────┐
│  NeonDrawLottery.sol  +  Chainlink VRF  +  Automation            │
└────────────────────────────────────────────────────────────────────┘
```

## Repository layout (incremental)

| Path | Purpose | Phase |
|------|---------|-------|
| `index.html`, `js/` | Legacy MVP UI (unchanged until Phase 3) | - |
| `contracts/LotteryPool.sol` | Legacy escrow (deprecated path) | - |
| `blockchain/` | Hardhat, `NeonDrawLottery.sol`, tests, deploy | **1** |
| `backend/` | .NET 9 API, EF Core, migrations | **1** |
| `frontend/` | Next.js + TypeScript (future) | 3 |
| `docs/ADR/` | Architecture decision records | **1** |

## Draw business model

Four draw tiers: **Daily**, **Weekly**, **Monthly**, **Quarterly**.

Each draw has:

- `opensAt`, `closesAt` (UTC)
- `ticketPrice` (wei or ERC20 amount)
- `advertisedJackpot` (marketing; actual payout = pool × policy)
- `winnerCount`, prize distribution rules
- Lifecycle: `Open` → `Closed` → `VRFRequested` → `Settled`

Payout policy (product): player payouts capped at **1-3% of draw pool** (daily) and **2% global inflow** - enforced on-chain and/or in backend policy engine (ADR-002).

## Ticket model (canonical)

| Field | Source of truth |
|-------|-----------------|
| `ticketId` | Smart contract |
| `drawId` | Smart contract + DB |
| `wallet` | `msg.sender` |
| `numbers[6]` | Calldata on `buyTicket` |
| `txHash`, `chainId` | Receipt + network |
| `purchasedAt` | Block timestamp (indexed) |

Browser-generated IDs (`T-${Date.now()}`) are **deprecated**.

## Migration phases

### Phase 1 - Foundation (this sprint)

- [x] Architecture docs
- [x] `NeonDrawLottery.sol` skeleton (buy ticket, draw struct, events, pause)
- [x] Hardhat compile + unit tests
- [x] ASP.NET Core API + PostgreSQL schema + `GET /api/draws`
- [x] Docker Compose for local Postgres
- [x] Legacy UI unchanged

### Phase 2 - Provable draws

- Chainlink VRF v2.5 + Automation
- Remove client draw execution from `draw-engine.js`
- Chain event indexer → PostgreSQL

### Phase 3 - Frontend

- Next.js app; Wagmi + RainbowKit
- Deprecate simulated activity feed

### Phase 4 - Real-time & admin

- SignalR, Hangfire, admin APIs, Azure deployment

### Phase 5 - Compliance

- KYC/AML hooks, limits, geo-block, audit exports

## Security baseline (target)

- Rate limiting, JWT, RBAC, CSP, wallet signature verification
- Azure Key Vault for secrets
- No private keys in repo; no seed phrases in UI inputs (already in MVP)

## Local development

```bash
# Legacy MVP
./scripts/start-dev.sh

# Blockchain (Phase 1)
cd blockchain && npm install && npm run compile

# Backend (requires .NET 9 SDK)
cd backend && docker compose up -d
dotnet run --project src/NeonDraw.Api
```

## Related

- [ADR-001: Source of truth](ADR/001-source-of-truth.md)
- [ADR-002: Payout policy layer](ADR/002-payout-policy.md)
