# StarBitz — Crypto Lottery

Crypto lottery platform with Web3 wallet payments, automatic draws, and live ticket activity.

**Live repo:** https://github.com/mateenashraf/crypto-casino

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
| 6-Month | $20,000,000 |
| Yearly | $50,000,000 |

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
| [docs/WEBSITE.md](docs/WEBSITE.md) | Full site docs, deploy, Web3 config, project structure |
| [docs/GOOGLE-ADS.md](docs/GOOGLE-ADS.md) | **Google Ads funnel, keywords, ad copy, $100/mo budget** |

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
├── contracts/LotteryPool.sol
├── docs/
│   ├── WEBSITE.md
│   └── GOOGLE-ADS.md
└── scripts/push-to-github.sh
```

---

## Deploy to GitHub Pages

Settings → Pages → Branch `main` → `/ (root)`  
URL: `https://mateenashraf.github.io/crypto-casino/`

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
