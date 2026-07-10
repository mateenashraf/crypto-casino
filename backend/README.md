# NeonDraw Backend

ASP.NET Core 9 API for draw history, tickets, and compliance indexing.

## Prerequisites

- [.NET 9 SDK](https://dotnet.microsoft.com/download)
- Docker (for PostgreSQL)

## Quick start

```bash
cd backend
docker compose up -d
dotnet run --project src/NeonDraw.Api
```

Endpoints:

- `GET /health` (liveness)
- `GET /api/draws` (open and scheduled draws; seed data in Development)
- Swagger UI at `/swagger` in Development

## Structure

```
src/
  NeonDraw.Domain/       Entities and enums
  NeonDraw.Application/  DTOs and service interfaces
  NeonDraw.Infrastructure/ EF Core + PostgreSQL
  NeonDraw.Api/          HTTP host
```

See [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for the full migration plan.
