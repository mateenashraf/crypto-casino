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
    OPERATOR_RETAIN_RATIO: 0.90,
    GLOBAL_PAYOUT_CAP_RATIO: 0.10,
    DAILY_PAYOUT_MIN_RATIO: 0.01,
    DAILY_PAYOUT_MAX_RATIO: 0.03,
    MAJOR_DRAW_PAYOUT_RATIO: 0.10,
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
  /** Winners only when a scheduled draw closes — not on a fake timer */
  const LIVE_WINNERS_ENABLED = false;
  const WINNERS_LIST_LIMIT = 15;

  const DRAW_TIERS = [
    {
      id: 'daily',
      name: 'Daily Draw',
      icon: 'sun',
      prizes: [2000, 2500, 3000, 3500],
      getPrize: (date) => {
        const prizes = [2000, 2500, 3000, 3500];
        return prizes[date.getDate() % prizes.length];
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
      prize: 2_000_000,
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
      prize: 5_000_000,
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
      prize: 10_000_000,
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
      ? randomRange(ECONOMICS.DAILY_PAYOUT_MIN_RATIO, ECONOMICS.DAILY_PAYOUT_MAX_RATIO)
      : ECONOMICS.MAJOR_DRAW_PAYOUT_RATIO;
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
      matchCount: outcome.matchCount != null
        ? (window.PrizeTierMatrix?.capMatchCount?.(outcome.matchCount) ?? outcome.matchCount)
        : null,
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
    const list = getWinners();
    let changed = false;

    const clampMatch = (entry) => {
      if (entry.matchCount == null || entry.matchCount <= 4) return entry;
      changed = true;
      return { ...entry, matchCount: 4 };
    };

    const fixed = list.map((w) => {
      const tier = getTier(w.drawId) || DRAW_TIERS[0];
      const labelNum = parseFloat(String(w.prizeLabel || '').replace(/[^0-9.]/g, '')) || 0;
      const pool = Number(w.drawPoolUsd) || 0;
      const needsFix = labelNum > 50_000 || (labelNum > pool && pool > 0) || w.prize > pool;
      if (!needsFix && w.paidUsd != null) return clampMatch(w);
      if (w.prizeType === 'free_ticket') return clampMatch(w);
      const cappedMatch = window.PrizeTierMatrix?.capMatchCount?.(w.matchCount) ?? w.matchCount;
      const paid = pool > 0
        ? Math.round(computePaidUsd(tier, {
          prizeType: 'cash',
          displayUsd: labelNum || w.prize || 0,
          isJackpot: !!w.jackpotTierWin || w.microWin === false,
        }, pool))
        : Math.min(Number(w.prize) || 0, 25_000);
      changed = true;
      return clampMatch({
        ...w,
        prize: paid,
        paidUsd: paid,
        prizeLabel: formatUsd(paid),
        matchCount: cappedMatch >= 5 ? 4 : cappedMatch,
        jackpotTierWin: !!w.jackpotTierWin || (w.microWin === false && paid < (w.advertisedPrize || 0) * 0.5),
        microWin: paid < 10_000,
      });
    });
    if (changed) SecureStorage.setJSON(STORAGE_WINNERS, fixed);
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
      daily: [2800, 9500],
      weekly: [18000, 95000],
      monthly: [42000, 285000],
      quarterly: [85000, 520000],
    };
    const [lo, hi] = ranges[tier.id] || ranges.monthly;
    return Math.round(randomRange(lo, hi));
  }

  function injectShowcaseWinner() {
    const tier = DRAW_TIERS[Math.floor(Math.random() * DRAW_TIERS.length)];
    const amt = randomShowcasePrize(tier);
    const outcome = {
      prizeType: 'cash',
      prizeLabel: formatUsd(amt),
      displayUsd: amt,
      isJackpot: true,
      matchCount: 4,
      freeQty: 0,
    };
    const entry = buildWinnerEntry({
      tier,
      outcome,
      drawPoolUsd: Math.round(randomRange(80_000, 650_000)),
      numbers: winningNumbers(),
      winner: { wallet: fakeWinner(), numbers: winningNumbers() },
      source: 'showcase',
      fromRealTicket: false,
      accountedPayoutUsd: amt,
      timestamp: Date.now(),
      seeded: true,
    });
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
      const amt = randomSmallPrize(tier);
      return { prizeType: 'cash', prizeLabel: formatUsd(amt), displayUsd: amt, isJackpot: false };
    }
    if (r < mediumEnd) {
      const amt = randomMediumPrize(tier);
      return { prizeType: 'cash', prizeLabel: formatUsd(amt), displayUsd: amt, isJackpot: false };
    }
    if (jackpotW > 0 && r < jackpotEnd) {
      const showcaseAmt = randomShowcasePrize(tier);
      const amt = Math.min(advertisedPrize, showcaseAmt);
      return {
        prizeType: 'cash',
        prizeLabel: formatUsd(amt),
        displayUsd: amt,
        isJackpot: true,
        matchCount: 4,
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
    const dailyPayoutCap = dailyInflowAfter * ECONOMICS.GLOBAL_PAYOUT_CAP_RATIO;
    const lifetimePayoutCap = lifetimeInflowAfter * ECONOMICS.GLOBAL_PAYOUT_CAP_RATIO;
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
      label.innerHTML = `${window.Icons?.inline(tier.icon, 16, 'icon icon-gold icon-inline') || ''}<span>${tier.name}</span>`;
      label.classList.add('featured-draw-label');
    }

    const sub = document.getElementById('featuredDrawSub');
    if (sub) sub.textContent = `Top prize ${formatUsd(prize)} · Pick 6 from 49 · Draw closes when countdown hits zero`;

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

  function renderWinners() {
    const el = document.getElementById('winnersList');
    if (!el) return;

    const winners = getWinners();
    if (!winners.length) {
      el.innerHTML = '<p class="empty-winners">Winners roll in live throughout the day. Check back in a moment.</p>';
      return;
    }

    el.innerHTML = winners.slice(0, WINNERS_LIST_LIMIT).map((w) => {
      const prizeClass = w.prizeType === 'free_ticket'
        ? ' winner-prize-ticket'
        : w.jackpotTierWin ? ' winner-prize-jackpot' : '';
      const tierNote = w.jackpotTierWin
        ? `<span class="winner-tier-note">Top prize tier · ${formatUsd(w.advertisedPrize || w.prize)} jackpot</span>`
        : w.matchCount >= 2 && w.matchCount <= 4
          ? `<span class="winner-tier-note">${w.matchCount} of 6 matched</span>`
          : '';
      return `
      <div class="winner-row" data-winner-ts="${w.timestamp}">
        <div class="winner-prize${prizeClass}">${formatWinnerPrize(w)}</div>
        <div class="winner-meta">
          <strong>${w.drawName}</strong>
          ${tierNote}
          <span>Winning: ${w.numbers.join(' · ')}</span>
          <span class="winner-wallet">${w.winner.wallet}</span>
        </div>
        <div class="winner-time">${formatWinnerDateTime(w.timestamp)}</div>
      </div>
    `;
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
    const row = el?.querySelector('.winner-row');
    if (!row) return;
    row.classList.add('winner-row-new');
    setTimeout(() => row.classList.remove('winner-row-new'), 3200);
  }

  function tick() {
    checkDraws();
    updateDrawCardTimers();
    updateFeaturedDraw();
  }

  function init() {
    loadState();
    loadEconomics();
    ensureEconomicsWindow();
    normalizeStoredWinners();
    purgeLiveFeedWinners();
    seedWinnersIfNeeded();
    scheduleShowcaseWin();
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
  }

  function stop() {
    if (tickTimer) clearInterval(tickTimer);
    if (showcaseTimer) clearTimeout(showcaseTimer);
  }

  return {
    init, stop, getTiers: () => DRAW_TIERS, getSelectedDraw, setSelectedDraw,
    registerTicket, syncWalletTicketsToDraws, getSelectedDrawId: () => selectedDrawId, formatUsd,
    getEconomics: () => {
      ensureEconomicsWindow();
      const dailyCap = economicsState.dailyInflowUsd * ECONOMICS.GLOBAL_PAYOUT_CAP_RATIO;
      const lifetimeCap = economicsState.lifetimeInflowUsd * ECONOMICS.GLOBAL_PAYOUT_CAP_RATIO;
      return {
        ...ECONOMICS,
        ...economicsState,
        dailyRetainedUsd: economicsState.dailyInflowUsd - economicsState.dailyOutflowUsd,
        lifetimeRetainedUsd: economicsState.lifetimeInflowUsd - economicsState.lifetimeOutflowUsd,
        dailyPayoutCapUsd: dailyCap,
        lifetimePayoutCapUsd: lifetimeCap,
        dailyRemainingBudgetUsd: Math.max(0, dailyCap - economicsState.dailyOutflowUsd),
        lifetimeRemainingBudgetUsd: Math.max(0, lifetimeCap - economicsState.lifetimeOutflowUsd),
      };
    },
  };
})();

window.DrawEngine = DrawEngine;
