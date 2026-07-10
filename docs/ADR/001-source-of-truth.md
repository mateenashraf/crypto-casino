# ADR-001: Source of truth

**Status:** Accepted  
**Date:** 2026-07-05

## Context

The MVP stores tickets, winners, economics, and draw state in `localStorage` and runs draws with `Math.random()` in the browser. This is not auditable, provably fair, or suitable for real money.

## Decision

| Concern | Authority |
|---------|-----------|
| Ticket ownership & payment | Smart contract |
| Randomness & winner selection | Smart contract (Chainlink VRF) |
| Payout amounts (on-chain leg) | Smart contract |
| Ticket/draw history for UI & compliance | PostgreSQL (indexed from chain) |
| KYC, limits, geo-block | Backend |
| Real-time feed | Backend (SignalR), sourced from DB |
| UI preferences | Browser cache only |

`localStorage` in the legacy app may remain as an **offline cache** until the Next.js frontend is wired to the API. It must never be the only record of a paid ticket.

## Consequences

- Phase 1 adds contract events + API without removing the MVP.
- Phase 2 removes client-side draw execution.
- Ticket lookup must eventually call `GET /api/tickets?wallet=` not only local storage.
