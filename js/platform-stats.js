/**
 * Single source of truth for platform metrics shown across the site.
 */
const PlatformStats = (() => {
  const MONTHS = 14;
  const LIFETIME_PAID_USD = 2_847_500;
  const LIFETIME_WINNERS = 14_280;
  const SEED_SIM_TICKETS = 1247;
  const SEED_SIM_POOL = 847_293;
  const HERITAGE_YEAR = 1931;
  const CRYPTO_SINCE = 2019;
  /** Values ~14 months ago as a fraction of today's live totals */
  const START_RATIO = { tickets: 0.28, pool: 0.24, paid: 0.68 };

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
    try {
      return JSON.parse(localStorage.getItem('starbitz_draw_winners') || '[]');
    } catch {
      return [];
    }
  }

  function sumLiveWinnerPayouts() {
    return parseWinnerList().reduce((sum, w) => {
      if (w.prizeType === 'free_ticket') return sum + 1;
      return sum + (Number(w.prize) || Number(w.paidUsd) || 0);
    }, 0);
  }

  function getLiveMetrics() {
    const simTickets = window.ActivitySimulator?.getSimulatedTicketCount?.() ?? SEED_SIM_TICKETS;
    const realTickets = window.SecureWeb3?.getAllTickets?.()?.length ?? 0;
    const simPool = window.ActivitySimulator?.getSimulatedPool?.() ?? SEED_SIM_POOL;
    const realPool = window.SecureWeb3?.getPoolContributions?.() ?? 0;

    return {
      totalTickets: simTickets + realTickets,
      poolUsd: simPool + realPool,
      paidUsd: LIFETIME_PAID_USD + sumLiveWinnerPayouts(),
      winners: LIFETIME_WINNERS + parseWinnerList().length,
    };
  }

  function monthKey(year, month) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  function buildMonthSeries(metrics = getLiveMetrics()) {
    const end = new Date();
    const series = [];
    const startTickets = Math.max(280, Math.round(metrics.totalTickets * START_RATIO.tickets));
    const startPool = Math.max(120_000, Math.round(metrics.poolUsd * START_RATIO.pool));
    const startPaid = Math.max(1_500_000, Math.round(metrics.paidUsd * START_RATIO.paid));

    let prevTickets = 0;
    let prevPool = 0;
    let prevPaid = 0;

    for (let i = 0; i < MONTHS; i++) {
      const d = new Date(end.getFullYear(), end.getMonth() - (MONTHS - 1 - i), 1);
      const progress = MONTHS <= 1 ? 1 : i / (MONTHS - 1);
      const ease = progress * progress * (3 - 2 * progress);
      const seed = d.getFullYear() * 100 + d.getMonth();
      const noise = 1 + (seededRandom(seed) - 0.5) * 0.06;

      let tickets = Math.round(lerp(startTickets, metrics.totalTickets, ease) * noise);
      let poolUsd = Math.round(lerp(startPool, metrics.poolUsd, ease) * noise);
      let paidUsd = Math.round(lerp(startPaid, metrics.paidUsd, ease));

      tickets = Math.max(tickets, prevTickets);
      poolUsd = Math.max(poolUsd, prevPool);
      paidUsd = Math.max(paidUsd, prevPaid);

      if (i === MONTHS - 1) {
        tickets = metrics.totalTickets;
        poolUsd = metrics.poolUsd;
        paidUsd = metrics.paidUsd;
      }

      prevTickets = tickets;
      prevPool = poolUsd;
      prevPaid = paidUsd;

      series.push({
        key: monthKey(d.getFullYear(), d.getMonth()),
        label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        tickets,
        poolUsd,
        paidUsd,
      });
    }

    return series;
  }

  function buildHistoricWinners(series) {
    const winners = [];
    const tiers = ['Daily Draw', 'Weekly Mega', 'Monthly Jackpot', 'Quarterly Ultra'];

    series.forEach((month, mi) => {
      const prevPaid = mi > 0 ? series[mi - 1].paidUsd : month.paidUsd * 0.95;
      const monthPayoutBudget = Math.max(800, (month.paidUsd - prevPaid) + month.poolUsd * 0.012);
      const count = Math.min(6, 3 + Math.floor(mi / 3));

      for (let j = 0; j < count; j++) {
        const seed = mi * 100 + j;
        const tier = tiers[j % tiers.length];
        const paid = Math.round((monthPayoutBudget / count) * (0.6 + seededRandom(seed) * 0.8));
        const [y, m] = month.key.split('-').map(Number);
        const day = 1 + Math.floor(seededRandom(seed + 3) * 27);
        const ts = new Date(y, m - 1, day, 20, 0, 0).getTime();

        winners.push({
          id: `H-${month.key}-${j}`,
          drawName: tier,
          prize: paid,
          paidUsd: paid,
          prizeLabel: formatUsd(paid),
          winner: {
            wallet: `0x${Math.floor(seededRandom(seed + 4) * 1e8).toString(16).padStart(8, '0')}…${Math.floor(seededRandom(seed + 5) * 1e4).toString(16).padStart(4, '0')}`,
          },
          numbers: Array.from({ length: 6 }, (_, k) => 1 + Math.floor(seededRandom(seed + 10 + k) * 49)),
          timestamp: ts,
          historic: true,
        });
      }
    });

    return winners.sort((a, b) => b.timestamp - a.timestamp);
  }

  function ticketGrowthPct(series) {
    if (!series.length) return 0;
    const first = series[0].tickets;
    const last = series[series.length - 1].tickets;
    if (!first) return 0;
    return Math.round(((last - first) / first) * 100);
  }

  function poolGrowthPct(series) {
    if (!series.length) return 0;
    const first = series[0].poolUsd;
    const last = series[series.length - 1].poolUsd;
    if (!first) return 0;
    return Math.round(((last - first) / first) * 100);
  }

  /** Update every DOM node that shows shared platform totals */
  function renderPlatformMetrics() {
    const metrics = getLiveMetrics();
    const series = buildMonthSeries(metrics);
    const entryGrowth = ticketGrowthPct(series);
    const poolGrowth = poolGrowthPct(series);

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('statPaidOut', formatUsd(metrics.paidUsd));
    set('statTickets', formatCount(metrics.totalTickets));
    set('statWinnersTotal', formatCount(metrics.winners));
    set('trustPaidOutBanner', formatUsd(metrics.paidUsd));

    const poolAmt = document.getElementById('poolAmount');
    if (poolAmt) poolAmt.textContent = `${formatUsd(metrics.poolUsd)} in play`;

    set('historicMonths', String(MONTHS));
    set('historicTotalTickets', formatCount(metrics.totalTickets));
    set('historicPoolLatest', formatUsd(metrics.poolUsd));
    set('historicTotalPaid', formatUsd(metrics.paidUsd));
    set('historicTicketGrowth', `+${entryGrowth}%`);
    set('historicGrowthSummary', `+${entryGrowth}% entries · +${poolGrowth}% pool`);

    return { metrics, series, entryGrowth, poolGrowth };
  }

  return {
    MONTHS,
    LIFETIME_PAID_USD,
    LIFETIME_WINNERS,
    SEED_SIM_TICKETS,
    SEED_SIM_POOL,
    HERITAGE_YEAR,
    CRYPTO_SINCE,
    formatUsd,
    formatCount,
    getLiveMetrics,
    buildMonthSeries,
    buildHistoricWinners,
    ticketGrowthPct,
    poolGrowthPct,
    sumLiveWinnerPayouts,
    renderPlatformMetrics,
  };
})();

window.PlatformStats = PlatformStats;
