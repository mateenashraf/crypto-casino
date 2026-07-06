# NeonDraw Frontend (API client)

A **separated** web UI for NeonDraw that talks to the ASP.NET Core backend over HTTP. It holds no lottery state of its own — draws, tickets, pool, winners, and stats all come from the API. This replaces the localStorage-driven logic of the legacy `../js/` MVP.

## Run

The backend must be running first (see [`../backend/README.md`](../backend/README.md)):

```bash
# backend on :5080
dotnet run --project ../backend/src/NeonDraw.Api --urls http://localhost:5080
```

Then serve this folder with any static server, e.g.:

```bash
python3 -m http.server 8090 --directory .
# or from the repo root:  python3 -m http.server 8090 --directory frontend
```

Open <http://localhost:8090>.

## Configure the API base URL

The API base URL is shown in the top bar and persisted in `localStorage` (`neondraw_api_base`), defaulting to `http://localhost:5080`. Change it there to point at a remote API. CORS is open on the backend.

## What it demonstrates

- Live stats + payout policy from `GET /api/stats` / `GET /api/pool-policy`
- Draw list / selection from `GET /api/draws`
- Number picker + ticket purchase via `POST /api/tickets`
- Ticket lookup via `GET /api/tickets?wallet=…`
- Winner history via `GET /api/winners`

## Structure

```
frontend/
  index.html
  css/app.css
  js/api.js    # fetch wrapper + endpoints (configurable base URL)
  js/app.js    # UI logic (no business rules — those live in the API)
```
