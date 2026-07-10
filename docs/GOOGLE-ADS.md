# NeonDraw - Google Ads Playbook ($100/month)

Budget: **~$3.30/day** · Goal: **ticket purchases / wallet connects**

> **Policy note:** Google restricts gambling and lottery ads in most countries. You typically need licensing + Google Ads certification. If ads are rejected, use the same structure on **Meta, X, Reddit, or Telegram**.

---

## Funnel

```
Ad click
    ↓
Landing page (jackpot + countdown + live activity)
    ↓
Select draw tier → Pick 6 numbers
    ↓
Connect wallet (MetaMask)
    ↓
Buy ticket (on-chain payment)
    ↓
Remarketing (visited but didn't buy) → "Jackpot ends soon"
```

### Landing page requirements

- [x] Big jackpot above the fold ($20M / $50M)
- [x] Countdown to next draw
- [x] "Buy Tickets" CTA
- [x] Live activity feed
- [x] Draw schedule cards
- [x] Wallet connect → buy flow
- [ ] Custom domain (recommended for ads)
- [ ] GA4 conversion tracking
- [ ] Terms, Privacy, Responsible Gaming pages

---

## Campaign setup

| Setting | Value |
|---------|--------|
| Campaign type | **Search** only |
| Daily budget | **$3.33** |
| Monthly total | **~$100** |
| Bidding | Maximize clicks → then Maximize conversions |
| Networks | Search only (disable Display & Search partners if CPC high) |
| Location | **1 country** to start (US, UK, CA, or AU) |
| Language | English |

**Structure:** 1 campaign · 3 ad groups

---

## Budget split

| Ad group | % | $/month | Focus |
|----------|---|---------|--------|
| Online lottery | 40% | $40 | Core lottery intent |
| Crypto lottery | 35% | $35 | BTC/ETH/USDT players |
| Jackpot intent | 25% | $25 | High-value seekers |

**Remarketing:** Add after 100+ site visitors ($0 at launch).

**Expected results:** ~15-40 clicks/month at $2.50-$6 CPC → ~5-15 wallet connects at 10-20% conversion.

---

## Ad Group 1 - Online lottery (~$40/mo)

**Match types:** Phrase `"keyword"` and Exact `[keyword]` first.

```
"online lottery"
"play lottery online"
"buy lottery tickets online"
"international lottery online"
"lottery online real money"
"daily lottery online"
"weekly lottery jackpot"
"mega lottery online"
"biggest online lottery"
"lottery jackpot online"
"online lotto"
"lotto online"
"play lotto online"
"win lottery online"
"international lotto online"
"real money lottery online"
"lottery app online"
"best online lottery"
```

---

## Ad Group 2 - Crypto lottery (~$35/mo)

```
"crypto lottery"
"bitcoin lottery"
"ethereum lottery"
"crypto lotto"
"web3 lottery"
"blockchain lottery"
"anonymous lottery online"
"no kyc lottery"
"crypto jackpot"
"bitcoin jackpot lottery"
"play lottery with bitcoin"
"play lottery with crypto"
"usdt lottery"
"metamask lottery"
"crypto gambling lottery"
"decentralized lottery"
"defi lottery"
"instant crypto lottery"
```

---

## Ad Group 3 - High-intent jackpot (~$25/mo)

```
"win million online"
"million dollar lottery"
"20 million jackpot"
"50 million lottery"
"biggest jackpot online"
"instant lottery payout"
"online jackpot daily"
"weekly million lottery"
"monthly jackpot lottery"
"life changing jackpot"
"huge lottery jackpot"
"play for millions online"
"lottery mega jackpot"
"win big online lottery"
```

---

## Negative keywords (add all)

Prevents wasted spend on irrelevant clicks:

```
free
jobs
career
hiring
software
white label
api
source code
github
hack
cheat
bot
guaranteed win
predict
rehab
gamblers anonymous
addiction
lawyer
lawsuit
wiki
wikipedia
how to start
open a casino
license application
school
kids
under 18
torrent
crack
template
wordpress theme
affiliate program
```

---

## Ad copy

### Headlines (use 15, rotate)

1. Win Up To $50 Million
2. NeonDraw Crypto Lottery
3. Daily Draws From $2,000
4. $20M Jackpot - Enter Now
5. Buy Tickets With Crypto
6. Bitcoin · Ethereum · USDT
7. Instant Crypto Payouts
8. Weekly $2M Mega Draw
9. Pick 6 Numbers - Win Big
10. No Bank Account Needed
11. Draws Every Day
12. Join Players Worldwide
13. Secure Web3 Lottery
14. Quick Pick Or Choose Numbers
15. Next Draw Countdown Live

### Descriptions (use 4)

**Description 1:**  
Daily, weekly & monthly crypto lottery draws. Jackpots up to $50M. Buy tickets with BTC, ETH & USDT in seconds.

**Description 2:**  
Pick 6 numbers, pay with crypto, win instantly. $20M grand draw + daily prizes from $2K. Connect wallet & play.

**Description 3:**  
The biggest crypto lottery online. Automatic draws. Live jackpots. Secure Web3 payments. Enter before the countdown ends.

**Description 4:**  
Weekly $2M · Monthly $5M · Yearly $50M. NeonDraw - instant deposits, fast withdrawals, provably fair draws.

### URL settings

- **Final URL:** Your live site (e.g. `https://your-domain.example/`)
- **Display path:** `Lottery` / `Win-Big`

---

## Conversion tracking (GA4)

| Event name | Trigger |
|------------|---------|
| `wallet_connect` | Wallet connected successfully |
| `ticket_purchase` | Ticket purchase confirmed on-chain |
| `draw_select` | User clicks a draw schedule card |
| `signup_start` | User clicks "Buy Tickets" |

Set **Primary conversion:** `ticket_purchase`  
Set **Secondary conversion:** `wallet_connect`

---

## Week 1 optimization schedule

| Day | Action |
|-----|--------|
| 1-3 | Launch 3 ad groups with Exact + Phrase match only |
| 4-7 | Pause keywords with 0 clicks and CPC > $8 |
| 7+ | Increase bids on keywords that drove wallet connects |
| 14+ | Add remarketing campaign: "Jackpot ends in X hours - enter now" |
| 30 | Review full month - cut bottom 50% of keywords by CPA |

---

## If Google rejects ads - alternative platforms

Use the **same keywords and ad copy** on:

| Platform | Notes |
|----------|--------|
| **Meta (Facebook/Instagram)** | Business verification; crypto/gambling policies vary by region |
| **X (Twitter)** | Strong crypto audience; promote jackpot + urgency |
| **Reddit** | Target r/cryptocurrency, r/Bitcoin, r/gambling - check subreddit rules |
| **Telegram Ads** | Crypto-native; good for lottery/jackpot messaging |

---

## Launch checklist

- [ ] Site deployed on HTTPS (GitHub Pages or custom domain)
- [ ] Google Ads account created
- [ ] GA4 installed with conversion events
- [ ] Campaign created (1 campaign, 3 ad groups)
- [ ] All keywords added (Exact + Phrase)
- [ ] All negative keywords added
- [ ] Ad copy pasted (15 headlines, 4 descriptions)
- [ ] Daily budget set to $3.33
- [ ] Location limited to 1 country
- [ ] Search network only
- [ ] Review performance after 7 days

---

## Quick reference - prize ladder (for ad copy)

| Draw | Prize |
|------|-------|
| Daily | $2,000 - $3,500 |
| Weekly | $2,000,000 |
| Monthly | $5,000,000 |
| Quarterly | $10,000,000 |
