# StarBitz — Crypto Casino Demo

A BitStarz-inspired crypto casino front-end with Web3 wallet payments. Dark-mode UI, game browsing, promotions, and a unified wallet for deposits and withdrawals.

> **Demo only** — not affiliated with BitStarz. For educational/portfolio use. Real-money gambling requires proper licensing.

## Features

- **BitStarz-style UI** — dark theme, sidebar navigation, hero banners, horizontal game sliders
- **5,000+ mock games** — searchable catalog with category filters
- **Web3 payments** — MetaMask / EIP-1193 wallet connect
- **On-chain deposits** — send ETH to treasury address via `ethers.js`
- **Casino balance** — per-wallet balance tracked locally (demo layer)
- **Slot simulator** — demo play mode + real balance wagering
- **Live stats** — animated jackpot counter, promotions, provider logos
- **Fully responsive** — mobile-friendly layout

## Quick Start

No Node.js required. Serve the static files over HTTP (required for MetaMask):

```bash
cd ~/Projects/crypto-casino
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080)

## Web3 Setup

1. Install [MetaMask](https://metamask.io/)
2. Click **Connect Wallet** in the header
3. For test deposits, switch MetaMask to **Sepolia testnet** and get free test ETH from a faucet
4. Open **Wallet → Deposit**, enter amount, confirm the transaction

### Treasury Address

Deposits are sent to the address in `js/wallet.js`:

```
TREASURY_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'
```

Replace with your own wallet or smart contract for production.

## Project Structure

```
crypto-casino/
├── index.html          # Main page
├── css/styles.css      # BitStarz-inspired dark theme
├── js/
│   ├── app.js          # UI logic, modals, slot game
│   ├── games.js        # Game catalog & search
│   └── wallet.js       # Web3 wallet integration
└── README.md
```

## Production Roadmap

To go beyond this demo:

- [ ] Deploy a deposit smart contract with event indexing
- [ ] Backend for withdrawals (hot wallet + queue)
- [ ] WalletConnect / RainbowKit for more wallets
- [ ] Multi-chain support (BTC via Lightning, USDT on multiple chains)
- [ ] Real game provider integrations (SoftSwiss, etc.)
- [ ] KYC/AML compliance layer
- [ ] Provably fair game engine

## License

MIT — demo project for educational purposes.
