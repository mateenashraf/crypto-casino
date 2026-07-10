# ADR-002: Payout policy enforcement layer

**Status:** Proposed  
**Date:** 2026-07-05

## Context

Marketing jackpots ($2M-$10M) differ from sustainable payout math (1-3% of pool per draw, 2% global cap). The MVP displayed advertised amounts in winner feeds; that was corrected in the legacy UI.

## Decision

1. **Advertised jackpot** - shown on draw cards only; not implied as guaranteed cash paid unless pool qualifies.
2. **Actual payout** - `min(pool × tierRatio, globalRemainingBudget)` computed at settlement.
3. **Enforcement** - Phase 2: primary enforcement in **Solidity** at `settleDraw`; backend mirrors for reporting and compliance alerts.
4. **Winner display** - always show **paid amount**; optional label “Top prize tier” with advertised max.

## Consequences

- Contract `settleDraw` must revert if payout exceeds configured caps.
- Backend `PrizeClaims` table stores both `advertisedJackpotUsd` and `paidAmountUsd`.
