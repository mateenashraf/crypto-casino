# NeonDraw Backend

ASP.NET Core 9 API for draws, tickets, winners, pool stats, and compliance indexing. This is the C# port of the core lottery domain that used to live in the client-side `js/` MVP.

## Prerequisites

- [.NET 9 SDK](https://dotnet.microsoft.com/download)
- Docker (for PostgreSQL) — **only for the Postgres provider**; local dev defaults to an in-memory database and needs neither Docker nor Postgres.

## Quick start (in-memory, zero dependencies)

```bash
cd backend
dotnet run --project src/NeonDraw.Api --urls http://localhost:5080
```

In `Development` the API uses an EF Core **in-memory** database (`Database:Provider=InMemory` in `appsettings.Development.json`), seeded with sample draws. Swagger UI is at `/swagger`.

## Quick start (PostgreSQL)

Set `Database:Provider=Postgres` (or run outside Development) and provide `ConnectionStrings:Default`:

```bash
cd backend
docker compose up -d
dotnet run --project src/NeonDraw.Api
```

## Tests

```bash
dotnet test NeonDraw.sln
```

## Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/health` | Liveness |
| GET | `/api/draws` | List draws |
| GET | `/api/draws/{onChainDrawId}` | Draw detail |
| POST | `/api/draws/{onChainDrawId}/settle` | Run a draw (pick winning numbers, choose winner, apply payout cap) |
| GET | `/api/winners?limit=` | Winner history |
| POST | `/api/tickets` | Buy ticket(s) — validates 6/49, updates pool, records tx |
| GET | `/api/tickets?wallet=0x…` | Ticket lookup by wallet |
| GET | `/api/stats` | Aggregate pool / tickets / winners / paid-out |
| GET | `/api/pool-policy` | Operator payout policy (98% retain, 2% payout cap) |

Business rules (number validation, pricing at `EthUsdRate`, payout caps) live in `NeonDraw.Domain` (`LotteryRules`, `LotteryConstants`, `PayoutPolicy`) and are covered by `tests/NeonDraw.Tests`.

## Structure

```
src/
  NeonDraw.Domain/       Entities and enums
  NeonDraw.Application/  DTOs and service interfaces
  NeonDraw.Infrastructure/ EF Core + PostgreSQL
  NeonDraw.Api/          HTTP host
```

See [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for the full migration plan.
