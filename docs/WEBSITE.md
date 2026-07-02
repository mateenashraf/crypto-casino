# NeonDraw — Website Documentation

## Live links

| Resource | URL |
|----------|-----|
| **GitHub repo** | https://github.com/<your-org-or-user>/<your-repo> |
| **Local dev** | http://localhost:8080 |

### Deploy (GitHub Pages)

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from branch** → `main` → `/ (root)`
3. Save — site at: `https://<your-org-or-user>.github.io/<your-repo>/`

### Run locally

```bash
cd ~/Projects/crypto-casino
ruby -run -e httpd . -p 8080
# or: python3 -m http.server 8080
```

MetaMask requires **HTTPS** or **localhost** — do not open `index.html` as a file.

---

## Product overview

**NeonDraw** is a crypto lottery platform with Web3 wallet payments, automatic scheduled draws, and live ticket activity.

### Draw schedule & prizes

| Draw | Prize | Schedule |
|------|-------|----------|
| **Daily Draw** | $2,000 – $3,500 (rotates) | Every midnight (local) |
| **Weekly Mega** | $2,000,000 | Every Sunday, 8:00 PM |
| **Monthly Jackpot** | $5,000,000 | 1st of each month, 9:00 PM |
| **Quarterly Ultra** | $10,000,000 | Every 3 months, 10:30 PM |

### Ticket tiers

| Price | ETH (≈ @ $3,200/ETH) |
|-------|----------------------|
| $5 | 0.001563 ETH |
| $20 | 0.00625 ETH |
| $50 | 0.015625 ETH |
| $100 | 0.03125 ETH |
| $300 | 0.09375 ETH |
| $500 | 0.15625 ETH |

Players pick **6 numbers (1–49)** or use **Quick Pick**, select a draw tier, connect wallet, and pay on-chain.

---

## Features

- **Dark UI** — BitStarz-inspired purple/gold theme
- **Auto draws** — `js/draw-engine.js` runs draws when countdown hits zero
- **Web3 wallet** — MetaMask / EIP-1193 via `js/wallet.js`
- **Secure payments** — Chain validation, min/max amounts, rate limiting
- **Live activity** — Ticker + purchase feed (`js/activity-simulator.js`)
- **Responsive layout** — Desktop sidebar + mobile menu
- **Smart contract** — Optional `contracts/LotteryPool.sol` escrow

---

## Project structure

```
crypto-casino/
├── index.html                 # Main landing + lottery UI
├── css/styles.css             # All styles
├── js/
│   ├── wallet.js              # SecureWeb3 — connect, deposit, buy ticket
│   ├── lottery.js             # Number picker, tiers, ticket purchase UI
│   ├── draw-engine.js         # Scheduled draws + winners
│   ├── activity-simulator.js  # Live global purchase feed
│   └── app.js                 # Modals, wallet UI, init
├── contracts/
│   └── LotteryPool.sol        # On-chain lottery escrow (optional)
├── docs/
│   ├── WEBSITE.md             # This file
│   └── GOOGLE-ADS.md          # Ads funnel, keywords, budget
└── scripts/
    └── push-to-github.sh      # Upload to GitHub without git
```

---

## Web3 configuration

Edit `js/wallet.js`:

```javascript
ALLOWED_CHAIN_IDS: [11155111, 1],  // Sepolia testnet, Mainnet
TREASURY_ADDRESS: '<set-your-private-treasury-address>',
LOTTERY_CONTRACT: null,            // Set after deploying LotteryPool.sol
MIN_ETH: 0.001,
MAX_ETH: 2,
```

### Deploy smart contract (optional)

1. Deploy `contracts/LotteryPool.sol` on your chain
2. Set `LOTTERY_CONTRACT` to the deployed address
3. Ticket purchases call `buyTicket()` on-chain instead of direct treasury transfer

---

## Analytics (recommended for ads)

Add Google Analytics 4 and track:

| Event | When |
|-------|------|
| `wallet_connect` | User connects MetaMask |
| `ticket_purchase` | On-chain ticket confirmed |
| `draw_view` | User clicks a draw card |
| `page_view` | Landing page load |

---

## Push updates to GitHub

```bash
cd ~/Projects/crypto-casino
./scripts/push-to-github.sh
```

Requires `gh auth login` once.
