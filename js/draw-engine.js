/**
 * Automatic multi-tier lottery draw engine
 * Daily · Weekly · Monthly · Semi-Annual · Yearly
 */
const DrawEngine = (() => {
  const STORAGE_DRAWS = 'starbitz_draw_state';
  const STORAGE_WINNERS = 'starbitz_draw_winners';
  const STORAGE_TICKETS_BY_DRAW = 'starbitz_tickets_by_draw';

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
      id: 'semi-annual',
      name: '6-Month Grand',
      icon: 'gem',
      prize: 20_000_000,
      getNextDraw: () => {
        const n = new Date();
        const month = n.getMonth();
        const year = n.getFullYear();
        const next = month < 6
          ? new Date(year, 6, 1, 22, 0, 0)
          : new Date(year + 1, 0, 1, 22, 0, 0);
        if (next.getTime() <= Date.now()) {
          return month < 6
            ? new Date(year + 1, 0, 1, 22, 0, 0).getTime()
            : new Date(year + 1, 6, 1, 22, 0, 0).getTime();
        }
        return next.getTime();
      },
    },
    {
      id: 'yearly',
      name: 'Yearly Ultra',
      icon: 'crown',
      prize: 50_000_000,
      getNextDraw: () => {
        const n = new Date();
        n.setFullYear(n.getFullYear() + 1, 0, 1);
        n.setHours(23, 0, 0, 0);
        return n.getTime();
      },
    },
  ];

  let state = {};
  let selectedDrawId = 'semi-annual';
  let tickTimer = null;

  function loadState() {
    try {
      state = JSON.parse(localStorage.getItem(STORAGE_DRAWS) || '{}');
    } catch {
      state = {};
    }
    DRAW_TIERS.forEach((tier) => {
      if (!state[tier.id]) {
        state[tier.id] = { nextDraw: tier.getNextDraw(), lastRun: null };
      }
    });
    saveState();
  }

  function saveState() {
    localStorage.setItem(STORAGE_DRAWS, JSON.stringify(state));
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

  function runDraw(tier) {
    const numbers = winningNumbers();
    const tickets = getTicketsForDraw(tier.id);
    const winner = tickets.length
      ? tickets[Math.floor(Math.random() * tickets.length)]
      : null;
    const prize = getPrize(tier);

    const entry = {
      drawId: tier.id,
      drawName: tier.name,
      prize,
      numbers,
      winner: winner
        ? { wallet: winner.wallet?.slice(0, 6) + '...' + winner.wallet?.slice(-4), numbers: winner.numbers }
        : { wallet: fakeWinner(), numbers: winningNumbers() },
      timestamp: Date.now(),
    };

    saveWinner(entry);
    state[tier.id] = { nextDraw: tier.getNextDraw(), lastRun: Date.now() };
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
    if (sub) sub.textContent = `Prize: ${formatUsd(prize)} · Pick 6 numbers to enter`;

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

  function renderWinners() {
    const el = document.getElementById('winnersList');
    if (!el) return;

    const winners = getWinners();
    if (!winners.length) {
      el.innerHTML = '<p class="empty-winners">Draws run automatically. Winners appear here after each draw.</p>';
      return;
    }

    const esc = window.SBSecurity.escapeHtml;
    el.innerHTML = winners.slice(0, 12).map((w) => `
      <div class="winner-row">
        <div class="winner-prize">${esc(formatUsd(w.prize))}</div>
        <div class="winner-meta">
          <strong>${esc(w.drawName)}</strong>
          <span>Winning: ${esc(w.numbers.join(' · '))}</span>
          <span class="winner-wallet">${esc(w.winner.wallet)}</span>
        </div>
        <div class="winner-time">${esc(new Date(w.timestamp).toLocaleDateString())}</div>
      </div>
    `).join('');
  }

  function tick() {
    checkDraws();
    renderDrawCards();
    updateFeaturedDraw();
    renderWinners();
  }

  function init() {
    loadState();
    checkDraws();
    renderDrawCards();
    updateFeaturedDraw();
    renderWinners();

    tickTimer = setInterval(tick, 1000);

    window.addEventListener('draw-completed', (e) => {
      const w = e.detail;
      window.AppUI?.toast(`${w.drawName}: ${formatUsd(w.prize)} won!`, 'success');
      renderWinners();
    });
  }

  function stop() {
    if (tickTimer) clearInterval(tickTimer);
  }

  return {
    init, stop, getTiers: () => DRAW_TIERS, getSelectedDraw, setSelectedDraw,
    registerTicket, getSelectedDrawId: () => selectedDrawId, formatUsd,
  };
})();

window.DrawEngine = DrawEngine;
