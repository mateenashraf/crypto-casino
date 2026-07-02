/**
 * Automatic multi-tier lottery draw engine
 * Daily · Weekly · Monthly · Quarterly
 */
const DrawEngine = (() => {
  const STORAGE_DRAWS = 'starbitz_draw_state';
  const STORAGE_WINNERS = 'starbitz_draw_winners';
  const STORAGE_TICKETS_BY_DRAW = 'starbitz_tickets_by_draw';
  const STORAGE_ECONOMICS = 'starbitz_economics_state';
  const ECONOMICS = {
    OPERATOR_RETAIN_RATIO: 0.98,
    GLOBAL_PAYOUT_CAP_RATIO: 0.02,
    DAILY_PAYOUT_MIN_RATIO: 0.01,
    DAILY_PAYOUT_MAX_RATIO: 0.03,
    MAJOR_DRAW_PAYOUT_RATIO: 0.02,
    FREE_TICKET_USD_VALUE: 1,
  };
  const FREE_TICKET_WIN_RATE = 0.14;
  const FREE_TICKET_QTY = 1;

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

  function loadState() {
    try {
      state = JSON.parse(localStorage.getItem(STORAGE_DRAWS) || '{}');
    } catch {
      state = {};
    }
    DRAW_TIERS.forEach((tier) => {
      if (!state[tier.id]) {
        state[tier.id] = { nextDraw: tier.getNextDraw(), lastRun: null, runCount: 0 };
      }
    });
    saveState();
  }

  function saveState() {
    localStorage.setItem(STORAGE_DRAWS, JSON.stringify(state));
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
      const parsed = JSON.parse(localStorage.getItem(STORAGE_ECONOMICS) || '{}');
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
    localStorage.setItem(STORAGE_ECONOMICS, JSON.stringify(economicsState));
  }

  function getWinners() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_WINNERS) || '[]');
    } catch {
      return [];
    }
  }

  function saveWinner(entry) {
    const list = getWinners();
    list.unshift(entry);
    localStorage.setItem(STORAGE_WINNERS, JSON.stringify(list.slice(0, 50)));
  }

  function getTicketsForDraw(drawId) {
    const all = JSON.parse(localStorage.getItem(STORAGE_TICKETS_BY_DRAW) || '{}');
    return all[drawId] || [];
  }

  function registerTicket(drawId, ticket) {
    const all = JSON.parse(localStorage.getItem(STORAGE_TICKETS_BY_DRAW) || '{}');
    all[drawId] = [{ ...ticket, drawId }, ...(all[drawId] || [])].slice(0, 500);
    localStorage.setItem(STORAGE_TICKETS_BY_DRAW, JSON.stringify(all));
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
    if (entry.prizeType === 'free_ticket') return entry.prizeLabel;
    return formatUsd(entry.prize);
  }

  function randomRange(min, max) {
    return min + (Math.random() * (max - min));
  }

  function getDrawPoolUsd(tickets) {
    return tickets.reduce((sum, t) => sum + (Number(t.usdPrice) || 0), 0);
  }

  function runDraw(tier) {
    ensureEconomicsWindow();
    const numbers = winningNumbers();
    const tickets = getTicketsForDraw(tier.id);
    const winner = tickets.length
      ? tickets[Math.floor(Math.random() * tickets.length)]
      : null;
    const advertisedPrize = getPrize(tier);
    const drawPoolUsd = getDrawPoolUsd(tickets);
    const runCount = (state[tier.id]?.runCount || 0) + 1;
    const dailyInflowAfter = economicsState.dailyInflowUsd + drawPoolUsd;
    const lifetimeInflowAfter = economicsState.lifetimeInflowUsd + drawPoolUsd;
    const dailyPayoutCap = dailyInflowAfter * ECONOMICS.GLOBAL_PAYOUT_CAP_RATIO;
    const lifetimePayoutCap = lifetimeInflowAfter * ECONOMICS.GLOBAL_PAYOUT_CAP_RATIO;
    const remainingDailyBudget = Math.max(0, dailyPayoutCap - economicsState.dailyOutflowUsd);
    const remainingLifetimeBudget = Math.max(0, lifetimePayoutCap - economicsState.lifetimeOutflowUsd);
    const remainingGlobalBudget = Math.min(remainingDailyBudget, remainingLifetimeBudget);

    let payoutUsd = 0;
    if (winner && drawPoolUsd > 0 && remainingGlobalBudget > 0) {
      const payoutRatio = tier.id === 'daily'
        ? randomRange(ECONOMICS.DAILY_PAYOUT_MIN_RATIO, ECONOMICS.DAILY_PAYOUT_MAX_RATIO)
        : ECONOMICS.MAJOR_DRAW_PAYOUT_RATIO;
      payoutUsd = Math.min(drawPoolUsd * payoutRatio, remainingGlobalBudget);
    }

    let prize = Math.max(0, Math.round(payoutUsd));
    const isFreeTicketWinner = !!winner
      && Math.random() < FREE_TICKET_WIN_RATE
      && remainingGlobalBudget >= ECONOMICS.FREE_TICKET_USD_VALUE;

    let accountedPayoutUsd = prize;
    const prizeLabel = isFreeTicketWinner
      ? `${FREE_TICKET_QTY} Free Ticket${FREE_TICKET_QTY > 1 ? 's' : ''}`
      : formatUsd(prize || 0);

    if (isFreeTicketWinner && winner.wallet) {
      prize = 0;
      accountedPayoutUsd = ECONOMICS.FREE_TICKET_USD_VALUE * FREE_TICKET_QTY;
      window.SecureWeb3?.grantFreeTickets(winner.wallet, FREE_TICKET_QTY, {
        drawId: tier.id,
        drawName: tier.name,
      });
    }

    const entry = {
      drawId: tier.id,
      drawName: tier.name,
      prize,
      advertisedPrize,
      drawPoolUsd: Math.round(drawPoolUsd),
      retainedUsd: Math.max(0, Math.round(drawPoolUsd - accountedPayoutUsd)),
      microWin: false,
      prizeType: isFreeTicketWinner ? 'free_ticket' : 'cash',
      prizeLabel,
      numbers,
      winner: winner
        ? { wallet: winner.wallet?.slice(0, 6) + '...' + winner.wallet?.slice(-4), numbers: winner.numbers }
        : { wallet: fakeWinner(), numbers: winningNumbers() },
      timestamp: Date.now(),
    };

    economicsState.dailyInflowUsd = dailyInflowAfter;
    economicsState.lifetimeInflowUsd = lifetimeInflowAfter;
    economicsState.dailyOutflowUsd += accountedPayoutUsd;
    economicsState.lifetimeOutflowUsd += accountedPayoutUsd;
    saveEconomics();
    saveWinner(entry);
    state[tier.id] = { nextDraw: tier.getNextDraw(), lastRun: Date.now(), runCount };
    saveState();

    window.dispatchEvent(new CustomEvent('draw-completed', { detail: entry }));
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
    if (sub) sub.textContent = `Prize: ${formatUsd(prize)} · Global player payouts are capped at 2% of inflow`;

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
      el.innerHTML = '<p class="empty-winners">Draws run automatically. Winners appear here after each draw.</p>';
      return;
    }

    el.innerHTML = winners.slice(0, 12).map((w) => {
      const prizeClass = w.prizeType === 'free_ticket' ? ' winner-prize-ticket' : '';
      return `
      <div class="winner-row">
        <div class="winner-prize${prizeClass}">${formatWinnerPrize(w)}</div>
        <div class="winner-meta">
          <strong>${w.drawName}</strong>
          <span>Winning: ${w.numbers.join(' · ')}</span>
          <span class="winner-wallet">${w.winner.wallet}</span>
        </div>
        <div class="winner-time">${new Date(w.timestamp).toLocaleDateString()}</div>
      </div>
    `;
    }).join('');
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
    checkDraws();
    renderDrawCards();
    updateFeaturedDraw();
    renderWinners();

    tickTimer = setInterval(tick, 1000);

    window.addEventListener('draw-completed', (e) => {
      const w = e.detail;
      const msg = w.prizeType === 'free_ticket'
        ? `${w.drawName}: ${w.prizeLabel} awarded!`
        : w.prize > 0
          ? `${w.drawName}: ${formatUsd(w.prize)} won!`
          : `${w.drawName}: draw completed`;
      window.AppUI?.toast(msg, 'success');
      renderDrawCards();
      renderWinners();
    });
  }

  function stop() {
    if (tickTimer) clearInterval(tickTimer);
  }

  return {
    init, stop, getTiers: () => DRAW_TIERS, getSelectedDraw, setSelectedDraw,
    registerTicket, getSelectedDrawId: () => selectedDrawId, formatUsd,
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
