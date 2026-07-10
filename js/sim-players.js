/**
 * Shared simulated players for live tickers - recurring wallets like real regulars,
 * without the same address flooding every line.
 */
const SimPlayers = (() => {
  const ROSTER_SIZE = 100;
  const MAX_RECENT_APPEARANCES = 2;
  const RECENT_WINDOW = 14;
  const REPEAT_CHANCE = 0.16;

  let roster = [];
  let recent = [];

  function randomHex(len) {
    return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  function makeWallet() {
    return `0x${randomHex(4)}...${randomHex(4)}`;
  }

  function ensureRoster() {
    while (roster.length < ROSTER_SIZE) {
      const w = makeWallet();
      if (!roster.includes(w)) roster.push(w);
    }
  }

  function countInRecent(wallet) {
    return recent.filter((w) => w === wallet).length;
  }

  function pickWallet() {
    ensureRoster();

    if (recent.length && Math.random() < REPEAT_CHANCE) {
      const candidates = [...new Set(recent)].filter((w) => countInRecent(w) < MAX_RECENT_APPEARANCES);
      if (candidates.length) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        remember(pick);
        return pick;
      }
    }

    const fresh = roster.filter((w) => countInRecent(w) < MAX_RECENT_APPEARANCES);
    const pool = fresh.length ? fresh : roster;
    const avoidLast = recent.slice(0, 4);
    const preferred = pool.filter((w) => !avoidLast.includes(w));
    const use = preferred.length ? preferred : pool;
    const pick = use[Math.floor(Math.random() * use.length)];
    remember(pick);
    return pick;
  }

  function remember(wallet) {
    recent.unshift(wallet);
    recent = recent.slice(0, RECENT_WINDOW);
  }

  function weightedPick(entries) {
    const total = entries.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const e of entries) {
      r -= e.weight;
      if (r <= 0) return e.value;
    }
    return entries[entries.length - 1].value;
  }

  function roundMoney(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  /** Slot bets: everyday stakes + real high rollers */
  function slotBet() {
    return weightedPick([
      { value: 1, weight: 22 },
      { value: 2, weight: 18 },
      { value: 5, weight: 18 },
      { value: 10, weight: 14 },
      { value: 25, weight: 12 },
      { value: 50, weight: 8 },
      { value: 100, weight: 5 },
      { value: 0.5, weight: 3 },
    ]);
  }

  /** Common symbols most often; crown & lucky 7 still land for big hits */
  function slotSymbolId(catalog) {
    const ids = (catalog || []).map((s) => s.id);
    const has = (id) => ids.includes(id);
    const entries = [
      has('cherry') && { value: 'cherry', weight: 28 },
      has('orange') && { value: 'orange', weight: 24 },
      has('bell') && { value: 'bell', weight: 20 },
      has('crown') && { value: 'crown', weight: 16 },
      has('seven') && { value: 'seven', weight: 12 },
    ].filter(Boolean);
    if (!entries.length) return catalog?.[0]?.id || 'cherry';
    return weightedPick(entries);
  }

  /**
   * Slot payout from bet × symbol mult - small wins common, big jackpots allowed.
   */
  function slotPayout(betUsd, mult, { free = false } = {}) {
    if (free) {
      return roundMoney(0.75 + Math.random() * 8);
    }
    const m = mult || 2;
    const factor = 0.38 + Math.random() * 0.22;
    let payout = betUsd * m * factor;
    // Occasional full-strength hit (closer to table mult)
    if (Math.random() < 0.12) {
      payout = betUsd * m * (0.55 + Math.random() * 0.35);
    }
    payout = Math.max(payout, 0.85);
    return roundMoney(payout);
  }

  /** Roulette: small chips + high rollers */
  function rouletteBet() {
    return weightedPick([
      { value: 1, weight: 18 },
      { value: 2, weight: 16 },
      { value: 5, weight: 18 },
      { value: 10, weight: 16 },
      { value: 25, weight: 14 },
      { value: 50, weight: 10 },
      { value: 100, weight: 6 },
      { value: 250, weight: 2 },
    ]);
  }

  /** 1:1 outside bet → ~2× bet (no artificial cap) */
  function roulettePayout(betUsd) {
    return roundMoney(betUsd * 2);
  }

  /** Lottery ticket purchases - include whale tickets */
  function lotteryTicketUsd() {
    return weightedPick([
      { value: 5, weight: 20 },
      { value: 10, weight: 20 },
      { value: 20, weight: 14 },
      { value: 50, weight: 14 },
      { value: 100, weight: 12 },
      { value: 1, weight: 8 },
      { value: 300, weight: 7 },
      { value: 500, weight: 5 },
    ]);
  }

  return {
    pickWallet,
    slotBet,
    slotSymbolId,
    slotPayout,
    rouletteBet,
    roulettePayout,
    lotteryTicketUsd,
    weightedPick,
    roundMoney,
  };
})();

window.SimPlayers = SimPlayers;
