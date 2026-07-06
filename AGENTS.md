# StarBitz — Crypto Lottery

Static, client-side web app (vanilla HTML/CSS/JS + ethers.js via CDN). No backend, no database, no build step, and no package manager. All state lives in browser `localStorage`. See `README.md` and `docs/WEBSITE.md` for product/config details.

## Cursor Cloud specific instructions

- This is a pure static site. There are **no dependencies to install** and **no build/lint/test tooling** in the repo (no `package.json`, lockfiles, Makefile, or CI). The startup update script is a no-op.
- Run the app with the repo's zero-dependency Node dev server (serves the repo root with no-cache headers), then open `http://localhost:8080`:
  - `node scripts/dev-server.mjs 8080` (or `./scripts/start-dev.sh`, which also frees the port and opens a browser). Node is available; any static server works, but prefer the bundled Node one over `python3 -m http.server` / Ruby's `httpd`.
  - If you see `OSError: [Errno 98] Address already in use` (or the Node equivalent), a server is already bound to that port — reuse it, run on another port, or stop the existing PID (e.g. find it with `ss -ltnp | grep :8080`).
- It must be served over `http://localhost` (not opened as a `file://` path), because the Web3/MetaMask flow only works over `localhost`/HTTPS.
- Internet access is required at runtime: `ethers.js` and Google Fonts load from CDNs (`cdn.jsdelivr.net`, `fonts.googleapis.com`). Without network access the wallet code path breaks, but the core lottery UI still renders.
- Core lottery UI (number grid 1–49, Quick Pick, ticket tiers, scheduled draws, simulated activity feed) works with no wallet. The buy-ticket / on-chain payment flow requires a **MetaMask** extension on **Sepolia** (chainId `11155111`) or Mainnet with test ETH — not testable in a headless/clean browser without that extension.
- Web3 config (treasury address, optional `LOTTERY_CONTRACT`, allowed chain IDs) is hardcoded in `js/wallet.js` (`CONFIG` object), not in env files.
- `scripts/push-*.{sh,mjs}` are GitHub deploy helpers only (need `gh` auth or `GITHUB_TOKEN`); not part of running/testing the app.

### C# backend (`backend/`) + separated frontend (`frontend/`)

- The repo is migrating to a separated architecture (see `docs/ARCHITECTURE.md`): an **ASP.NET Core 9 API** in `backend/` (layered Domain/Application/Infrastructure/Api) and a **separated API-client frontend** in `frontend/` (vanilla HTML/CSS/JS that calls the API). The legacy static site (`index.html` + `js/`) still runs independently.
- **.NET 9 SDK is required and is NOT preinstalled.** Install once without root: `curl -fsSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 9.0 --install-dir "$HOME/.dotnet"`, then use `~/.dotnet` on `PATH` and set `DOTNET_ROOT=$HOME/.dotnet`.
- **Local dev needs no PostgreSQL/Docker:** `appsettings.Development.json` sets `Database:Provider=InMemory`, so the API uses an EF Core in-memory store (seeded with sample draws). Production uses Npgsql/Postgres (`Database:Provider=Postgres` + `ConnectionStrings:Default`, or `backend/docker compose up -d`).
- Run the API: `dotnet run --project backend/src/NeonDraw.Api --urls http://localhost:5080` (Swagger at `/swagger`). Test: `dotnet test backend/NeonDraw.sln`.
- Endpoints: `GET /api/draws`, `GET /api/draws/{id}`, `POST /api/draws/{id}/settle`, `GET /api/winners`, `POST /api/tickets`, `GET /api/tickets?wallet=0x…`, `GET /api/stats`, `GET /api/pool-policy`, `GET /health`.
- Serve the frontend separately (CORS is open): e.g. `python3 -m http.server 8090 --directory frontend`, then open `http://localhost:8090`. The API base URL is configurable in the top bar (persisted in `localStorage`), defaulting to `http://localhost:5080`.
- Draw settlement uses a server-side cryptographic RNG (not client `Math.random()`); production draws should still move to on-chain VRF per `docs/ARCHITECTURE.md`.
