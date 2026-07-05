# NeonDraw — Crypto Lottery

Crypto lottery platform with Web3 wallet payments, automatic draws, and live ticket activity.

**Live repo:** configure your own private or public repository

---

## Quick start

```bash
cd ~/Projects/crypto-casino
./scripts/start-dev.sh
```

Or manually:

```bash
node scripts/dev-server.mjs 8080
```

Open **http://127.0.0.1:8080** (use `127.0.0.1`, not a bookmarked old tab).

If you still see old content: hard refresh with **Cmd+Shift+R** or open an incognito window.

---

## Jackpots

| Draw | Prize |
|------|-------|
| Daily | $2,000 – $3,500 |
| Weekly | $2,000,000 |
| Monthly | $5,000,000 |
| Quarterly | $10,000,000 |

---

## Features

- Pick 6 numbers (1–49) or Quick Pick
- Ticket tiers: $5 – $500 (ETH via MetaMask)
- Automatic scheduled draws with winner history
- Live global ticket activity feed
- Secure Web3: chain validation, min/max limits, on-chain deposits
- Responsive dark UI (purple/gold theme)
- Optional smart contract: `contracts/LotteryPool.sol`

---

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | **Production migration plan (Phase 1+)** |
| [docs/WEBSITE.md](docs/WEBSITE.md) | Full site docs, deploy, Web3 config, project structure |
| [docs/GOOGLE-ADS.md](docs/GOOGLE-ADS.md) | **Google Ads funnel, keywords, ad copy, $100/mo budget** |

---

## Production stack (Phase 1)

Incremental refactor; the static MVP above keeps working.

| Path | Stack |
|------|-------|
| [blockchain/](blockchain/) | Hardhat, `NeonDrawLottery.sol`, OpenZeppelin |
| [backend/](backend/) | ASP.NET Core 9, PostgreSQL, `GET /api/draws` |

```bash
# Contract
cd blockchain && npm install && npm run compile && npm test

# API (requires .NET 9 SDK)
cd backend && docker compose up -d
dotnet run --project src/NeonDraw.Api
```

---

## Project structure

```
crypto-casino/
├── index.html
├── css/styles.css
├── js/
│   ├── wallet.js              # Secure Web3 payments
│   ├── lottery.js             # Ticket UI
│   ├── draw-engine.js         # Auto draws
│   ├── activity-simulator.js
│   └── app.js
├── contracts/LotteryPool.sol   # Legacy MVP escrow
├── blockchain/                 # Hardhat + NeonDrawLottery.sol
├── backend/                    # ASP.NET Core 9 API
├── docs/
│   ├── ARCHITECTURE.md
│   ├── WEBSITE.md
│   └── GOOGLE-ADS.md
└── scripts/push-to-github.sh
```

---

## Deploy to GitHub Pages

Settings → Pages → Branch `main` → `/ (root)`  
URL: `https://your-domain.example/`

---

## Push updates

```bash
./scripts/push-to-github.sh
```

Requires [GitHub CLI](https://cli.github.com/) (`gh auth login` once).

---

## Web3 config

Edit `js/wallet.js`:

- `TREASURY_ADDRESS` — deposit destination
- `LOTTERY_CONTRACT` — set after deploying `LotteryPool.sol`
- `ALLOWED_CHAIN_IDS` — `11155111` (Sepolia), `1` (Mainnet)

---

## License

MIT
