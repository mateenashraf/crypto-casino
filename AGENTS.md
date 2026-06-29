# StarBitz — Crypto Lottery

Static, client-side web app (vanilla HTML/CSS/JS + ethers.js via CDN). No backend, no database, no build step, and no package manager. All state lives in browser `localStorage`. See `README.md` and `docs/WEBSITE.md` for product/config details.

## Cursor Cloud specific instructions

- This is a pure static site. There are **no dependencies to install** and **no build/lint/test tooling** in the repo (no `package.json`, lockfiles, Makefile, or CI). The startup update script is a no-op.
- Run the app by serving the repo root over HTTP, then open `http://localhost:8080`:
  - `python3 -m http.server 8080` (the README suggests `ruby -run -e httpd . -p 8080`, but **Ruby is not installed** in this environment — use Python 3).
- It must be served over `http://localhost` (not opened as a `file://` path), because the Web3/MetaMask flow only works over `localhost`/HTTPS.
- Internet access is required at runtime: `ethers.js` and Google Fonts load from CDNs (`cdn.jsdelivr.net`, `fonts.googleapis.com`). Without network access the wallet code path breaks, but the core lottery UI still renders.
- Core lottery UI (number grid 1–49, Quick Pick, ticket tiers, scheduled draws, simulated activity feed) works with no wallet. The buy-ticket / on-chain payment flow requires a **MetaMask** extension on **Sepolia** (chainId `11155111`) or Mainnet with test ETH — not testable in a headless/clean browser without that extension.
- Web3 config (treasury address, optional `LOTTERY_CONTRACT`, allowed chain IDs) is hardcoded in `js/wallet.js` (`CONFIG` object), not in env files.
- `scripts/push-*.{sh,mjs}` are GitHub deploy helpers only (need `gh` auth or `GITHUB_TOKEN`); not part of running/testing the app.
