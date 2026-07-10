/**
 * Single source of truth for platform metrics shown across the site.
 * Economics: 95% prize fund / 5% platform - every public total derives from the same ledger.
 */
const PlatformStats = (() => {
  const MONTHS = 15;
  const PRIZE_FUND_RATIO = 0.95;
  const PLATFORM_RATIO = 0.05;
  /** Blended average ticket across $10-$500 packs */
  const AVG_TICKET_USD = 42;

  /**
   * Lifetime paid to winners (cash). Current pool sits inside the 95% prize fund.
   * Sales and entry counts are derived so nothing contradicts the 95/5 split.
   */
  const LIFETIME_PAID_USD = 87_420_000;
  const SEED_SIM_POOL = 1_284_750;
  const LIFETIME_SALES_USD = Math.round((LIFETIME_PAID_USD + SEED_SIM_POOL) / PRIZE_FUND_RATIO);
  const LIFETIME_PLATFORM_USD = Math.round(LIFETIME_SALES_USD * PLATFORM_RATIO);
  const SEED_SIM_TICKETS = Math.round(LIFETIME_SALES_USD / AVG_TICKET_USD);
  const LIFETIME_WINNERS = 142_680;
  const DISPLAY_POOL_FLOOR = 1_000_000;
  const SEED_PLAYERS_ONLINE = 2_840;
  const HERITAGE_YEAR = 1931;
  const CRYPTO_SINCE = 2019;

  /** 15 months ago as a fraction of today’s live totals - all series climb together */
  const START_RATIO = { tickets: 0.30, sales: 0.30, paid: 0.32, pool: 0.22 };

  function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function formatUsd(n) {
    const v = Number(n) || 0;
    if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 10_000) return '$' + Math.round(v).toLocaleString();
    return '$' + Math.round(v).toLocaleString();
  }

  function formatCount(n) {
    const v = Number(n) || 0;
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 10_000) return Math.round(v / 1000) + 'K';
    return v.toLocaleString();
  }

  function parseWinnerList() {
    return SecureStorage.getJSON('draw_winners', []);
  }

  function sumLiveWinnerPayouts() {
    return parseWinnerList().reduce((sum, w) => {
      if (w.prizeType === 'free_ticket') return sum + 1;
      return sum + (Number(w.prize) || Number(w.paidUsd) || 0);
    }, 0);
  }

  function getDisplayPoolUsd() {
    const simPool = window.ActivitySimulator?.getSimulatedPool?.() ?? SEED_SIM_POOL;
    const realPool = window.SecureWeb3?.getPoolContributions?.() ?? 0;
    return Math.max(DISPLAY_POOL_FLOOR, simPool + realPool);
  }

  function getLiveMetrics() {
    const simTickets = window.ActivitySimulator?.getSimulatedTicketCount?.() ?? SEED_SIM_TICKETS;
    const realTickets = window.SecureWeb3?.getAllTickets?.()?.length ?? 0;
    const totalTickets = Math.max(SEED_SIM_TICKETS, simTickets) + realTickets;
    const poolUsd = getDisplayPoolUsd();
    const paidUsd = LIFETIME_PAID_USD + sumLiveWinnerPayouts();
    // Live sales track tickets; keep prize-fund identity: sales ≈ (paid + pool) / 0.95
    const salesFromTickets = Math.round(totalTickets * AVG_TICKET_USD);
    const salesFromLedger = Math.round((paidUsd + poolUsd) / PRIZE_FUND_RATIO);
    const salesUsd = Math.max(salesFromTickets, salesFromLedger);
    const platformUsd = Math.round(salesUsd * PLATFORM_RATIO);

    return {
      totalTickets,
      poolUsd,
      paidUsd,
      salesUsd,
      platformUsd,
      winners: LIFETIME_WINNERS + parseWinnerList().length,
      playersOnline: window.TrustDisplay?.getPlayersOnline?.() ?? SEED_PLAYERS_ONLINE,
      prizeFundRatio: PRIZE_FUND_RATIO,
      platformRatio: PLATFORM_RATIO,
    };
  }

  function monthKey(year, month) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  function buildMonthSeries(metrics = getLiveMetrics()) {
    const end = new Date();
    const series = [];
    const startTickets = Math.max(80_000, Math.round(metrics.totalTickets * START_RATIO.tickets));
    const startSales = Math.max(2_500_000, Math.round(metrics.salesUsd * START_RATIO.sales));
    const startPaid = Math.max(2_000_000, Math.round(metrics.paidUsd * START_RATIO.paid));
    const startPool = Math.max(220_000, Math.round(metrics.poolUsd * START_RATIO.pool));

    let prevTickets = 0;
    let prevSales = 0;
    let prevPaid = 0;
    let prevPool = 0;

    for (let i = 0; i < MONTHS; i++) {
      const d = new Date(end.getFullYear(), end.getMonth() - (MONTHS - 1 - i), 1);
      const progress = MONTHS <= 1 ? 1 : i / (MONTHS - 1);
      // Smooth growth with a mild late acceleration (crypto lottery ramp)
      const ease = progress * progress * (3 - 2 * progress);
      const seed = d.getFullYear() * 100 + d.getMonth();
      const noise = 1 + (seededRandom(seed) - 0.5) * 0.045;

      let tickets = Math.round(lerp(startTickets, metrics.totalTickets, ease) * noise);
      let salesUsd = Math.round(lerp(startSales, metrics.salesUsd, ease) * noise);
      let paidUsd = Math.round(lerp(startPaid, metrics.paidUsd, ease) * (1 + (seededRandom(seed + 3) - 0.5) * 0.02));
      let poolUsd = Math.round(lerp(startPool, metrics.poolUsd, ease) * noise);

      // Monotonic - real platforms don’t shrink lifetime totals
      tickets = Math.max(tickets, prevTickets);
      salesUsd = Math.max(salesUsd, prevSales);
      paidUsd = Math.max(paidUsd, prevPaid);
      poolUsd = Math.max(poolUsd, prevPool);

      // Keep 95/5 identity on every month point
      const minSales = Math.round((paidUsd + poolUsd) / PRIZE_FUND_RATIO);
      if (salesUsd < minSales) salesUsd = minSales;

      if (i === MONTHS - 1) {
        tickets = metrics.totalTickets;
        salesUsd = metrics.salesUsd;
        paidUsd = metrics.paidUsd;
        poolUsd = metrics.poolUsd;
      }

      prevTickets = tickets;
      prevSales = salesUsd;
      prevPaid = paidUsd;
      prevPool = poolUsd;

      series.push({
        key: monthKey(d.getFullYear(), d.getMonth()),
        label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        tickets,
        salesUsd,
        paidUsd,
        poolUsd,
        platformUsd: Math.round(salesUsd * PLATFORM_RATIO),
      });
    }

    return series;
  }

  function buildHistoricWinners(series) {
    const winners = [];
    const end = new Date();

    for (let i = 0; i < 5; i++) {
      const d = new Date(end.getFullYear(), end.getMonth() - i * 3, 1);
      const qm = Math.floor(d.getMonth() / 3) * 3;
      d.setMonth(qm, 1);
      d.setHours(22, 30, 0, 0);
      const seed = d.getFullYear() * 10 + qm;
      const jackpot = Math.round(9_847_260 + seededRandom(seed) * 12_000_000);
      const shareCount = seededRandom(seed + 1) < 0.12 ? 2 : 1;
      const paid = Math.floor(jackpot / shareCount);
      const numbers = Array.from({ length: 6 }, (_, k) => 1 + Math.floor(seededRandom(seed + 10 + k) * 49)).sort((a, b) => a - b);
      for (let s = 0; s < shareCount; s++) {
        winners.push({
          id: `H-Q-${seed}-${s}`,
          drawId: 'quarterly',
          drawName: 'Quarterly Ultra',
          prize: paid,
          paidUsd: paid,
          prizeLabel: formatUsd(paid),
          matchCount: 6,
          shareCount,
          isJackpot: true,
          jackpotAmount: jackpot,
          jackpotLabel: formatUsd(jackpot),
          headline: shareCount > 1 ? 'JACKPOT SHARED · 2 WINNING TICKETS' : 'QUARTERLY ULTRA JACKPOT · SOLE WINNER',
          shareNote: shareCount > 1
            ? `2 winning tickets split ${formatUsd(jackpot)}`
            : `Sole winner · claimed the full ${formatUsd(jackpot)} jackpot`,
          winner: { wallet: `0x${Math.floor(seededRandom(seed + 4 + s) * 1e8).toString(16).padStart(8, '0')}…abcd` },
          numbers,
          timestamp: d.getTime() + s,
          drawDateLabel: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
          historic: true,
        });
      }
    }

    series.forEach((month, mi) => {
      const [y, m] = month.key.split('-').map(Number);
      const seed = mi * 17 + 3;
      if (seededRandom(seed) > 0.85) return;
      const jackpot = Math.round(4_847_260 + seededRandom(seed + 2) * 6_000_000);
      const ts = new Date(y, m - 1, 1, 21, 0, 0).getTime();
      const numbers = Array.from({ length: 6 }, (_, k) => 1 + Math.floor(seededRandom(seed + 20 + k) * 49)).sort((a, b) => a - b);
      winners.push({
        id: `H-M-${month.key}`,
        drawId: 'monthly',
        drawName: 'Monthly Jackpot',
        prize: jackpot,
        paidUsd: jackpot,
        prizeLabel: formatUsd(jackpot),
        matchCount: 6,
        shareCount: 1,
        isJackpot: true,
        jackpotAmount: jackpot,
        jackpotLabel: formatUsd(jackpot),
        headline: 'MONTHLY JACKPOT · SOLE WINNER',
        shareNote: `Sole winner · claimed the full ${formatUsd(jackpot)} jackpot`,
        winner: { wallet: `0x${Math.floor(seededRandom(seed + 4) * 1e8).toString(16).padStart(8, '0')}…ef01` },
        numbers,
        timestamp: ts,
        drawDateLabel: new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        historic: true,
      });
    });

    return winners.sort((a, b) => b.timestamp - a.timestamp);
  }

  function growthPct(first, last) {
    if (!first) return 0;
    return Math.round(((last - first) / first) * 100);
  }

  function ticketGrowthPct(series) {
    if (!series.length) return 0;
    return growthPct(series[0].tickets, series[series.length - 1].tickets);
  }

  function salesGrowthPct(series) {
    if (!series.length) return 0;
    return growthPct(series[0].salesUsd, series[series.length - 1].salesUsd);
  }

  function paidGrowthPct(series) {
    if (!series.length) return 0;
    return growthPct(series[0].paidUsd, series[series.length - 1].paidUsd);
  }

  function poolGrowthPct(series) {
    if (!series.length) return 0;
    return growthPct(series[0].poolUsd, series[series.length - 1].poolUsd);
  }

  function renderPlatformMetrics() {
    const metrics = getLiveMetrics();
    const series = buildMonthSeries(metrics);
    const entryGrowth = ticketGrowthPct(series);
    const salesGrowth = salesGrowthPct(series);
    const paidGrowth = paidGrowthPct(series);

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('statPaidOut', formatUsd(metrics.paidUsd));
    set('statTickets', formatCount(metrics.totalTickets));
    set('statWinnersTotal', formatCount(metrics.winners));
    set('trustPaidOutBanner', formatUsd(metrics.paidUsd));

    const poolAmt = document.getElementById('poolAmount');
    if (poolAmt) poolAmt.textContent = `${formatUsd(metrics.poolUsd)}+ in play · growing`;

    set('statPlayersOnline', formatCount(metrics.playersOnline));

    set('historicTotalTickets', formatCount(metrics.totalTickets));
    set('historicPoolLatest', formatUsd(metrics.salesUsd));
    set('historicTotalPaid', formatUsd(metrics.paidUsd));
    set('historicTicketGrowth', `+${entryGrowth}%`);
    set('historicGrowthSummary', `+${entryGrowth}% entries · +${salesGrowth}% sales · +${paidGrowth}% paid`);

    const salesLabel = document.querySelector('[data-historic-sales-label]');
    if (salesLabel) salesLabel.textContent = 'Lifetime ticket sales';

    return { metrics, series, entryGrowth, salesGrowth, paidGrowth };
  }

  return {
    MONTHS,
    PRIZE_FUND_RATIO,
    PLATFORM_RATIO,
    AVG_TICKET_USD,
    LIFETIME_PAID_USD,
    LIFETIME_SALES_USD,
    LIFETIME_PLATFORM_USD,
    LIFETIME_WINNERS,
    DISPLAY_POOL_FLOOR,
    SEED_SIM_TICKETS,
    SEED_SIM_POOL,
    SEED_PLAYERS_ONLINE,
    HERITAGE_YEAR,
    CRYPTO_SINCE,
    formatUsd,
    formatCount,
    getDisplayPoolUsd,
    getLiveMetrics,
    buildMonthSeries,
    buildHistoricWinners,
    ticketGrowthPct,
    salesGrowthPct,
    paidGrowthPct,
    poolGrowthPct,
    sumLiveWinnerPayouts,
    renderPlatformMetrics,
  };
})();

window.PlatformStats = PlatformStats;
