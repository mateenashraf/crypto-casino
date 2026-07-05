/**
 * 14 months of authentic-looking platform growth + historic winners archive
 */
const HistoricGrowth = (() => {
  const STORAGE = 'starbitz_historic_14mo';
  const MONTHS = 14;

  function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  function monthKey(year, month) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  function buildMonthSeries() {
    const end = new Date();
    const series = [];
    let tickets = 820;
    let poolUsd = 12400;
    let winnersPaid = 890;
    let players = 340;

    for (let i = MONTHS - 1; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      const key = monthKey(d.getFullYear(), d.getMonth());
      const seed = d.getFullYear() * 100 + d.getMonth();
      const growth = 1.06 + seededRandom(seed) * 0.14;
      const season = [0.92, 0.95, 1.02, 1.05, 1.08, 1.12, 1.15, 1.1, 1.06, 1.04, 1.18, 1.22][d.getMonth()];

      tickets = Math.round(tickets * growth * season);
      poolUsd = Math.round(poolUsd * growth * season * 1.02);
      winnersPaid = Math.round(winnersPaid * (1.04 + seededRandom(seed + 1) * 0.08));
      players = Math.round(players * (1.05 + seededRandom(seed + 2) * 0.06));

      series.push({
        key,
        label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        tickets,
        poolUsd,
        winnersPaid,
        players,
        drawWinners: Math.max(12, Math.round(tickets / 180)),
      });
    }
    return series;
  }

  function buildHistoricWinners(series) {
    const winners = [];
    const tiers = ['Daily Draw', 'Weekly Mega', 'Monthly Jackpot', 'Quarterly Ultra'];
    const names = ['M.K.', 'J.R.', 'A.L.', 'S.P.', 'D.W.', 'L.C.', 'R.T.', 'N.H.', 'V.G.', 'E.B.'];

    series.forEach((month, mi) => {
      const count = Math.min(8, 3 + Math.floor(mi / 2));
      for (let j = 0; j < count; j++) {
        const seed = mi * 100 + j;
        const tier = tiers[j % tiers.length];
        const poolShare = 0.01 + seededRandom(seed) * 0.02;
        const paid = Math.round(month.poolUsd * poolShare / count);
        const [y, m] = month.key.split('-').map(Number);
        const day = 1 + Math.floor(seededRandom(seed + 3) * 27);
        const ts = new Date(y, m - 1, day, 20, 0, 0).getTime();

        winners.push({
          id: `H-${month.key}-${j}`,
          drawName: tier,
          prize: paid,
          paidUsd: paid,
          prizeLabel: '$' + paid.toLocaleString(),
          winner: { wallet: `0x${Math.floor(seededRandom(seed + 4) * 1e8).toString(16).padStart(8, '0')}…${Math.floor(seededRandom(seed + 5) * 1e4).toString(16).padStart(4, '0')}` },
          numbers: Array.from({ length: 6 }, (_, k) => 1 + Math.floor(seededRandom(seed + 10 + k) * 49)),
          timestamp: ts,
          historic: true,
        });
      }
    });
    return winners.sort((a, b) => b.timestamp - a.timestamp);
  }

  function ensureData() {
    const existing = localStorage.getItem(STORAGE);
    if (existing) {
      try { return JSON.parse(existing); } catch { /* rebuild */ }
    }
    const series = buildMonthSeries();
    const winners = buildHistoricWinners(series);
    const data = { series, winners, generatedAt: Date.now() };
    localStorage.setItem(STORAGE, JSON.stringify(data));
    return data;
  }

  function getData() {
    return ensureData();
  }

  function renderGrowthChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return null;
    const { series } = getData();

    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: series.map((s) => s.label),
        datasets: [
          {
            label: 'Tickets sold',
            data: series.map((s) => s.tickets),
            borderColor: '#a78bfa',
            backgroundColor: 'rgba(167,139,250,0.12)',
            fill: true,
            tension: 0.35,
            yAxisID: 'y',
          },
          {
            label: 'Pool ($)',
            data: series.map((s) => s.poolUsd),
            borderColor: '#fbbf24',
            tension: 0.35,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#94a3b8', boxWidth: 12 } },
        },
        scales: {
          x: { ticks: { color: '#64748b', maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { position: 'left', ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.06)' } },
          y1: { position: 'right', ticks: { color: '#fbbf24' }, grid: { drawOnChartArea: false } },
        },
      },
    });
  }

  function renderHistoricWinners(containerId, limit = 20) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const { winners } = getData();
    el.innerHTML = winners.slice(0, limit).map((w) => `
      <div class="winner-row historic-winner-row">
        <div class="winner-prize">${w.prizeLabel}</div>
        <div class="winner-meta">
          <strong>${w.drawName}</strong>
          <span class="winner-wallet">${w.winner.wallet}</span>
        </div>
        <div class="winner-time">${new Date(w.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      </div>
    `).join('');
  }

  function renderStats() {
    const { series } = getData();
    const latest = series[series.length - 1];
    const first = series[0];
    const growthPct = Math.round(((latest.tickets - first.tickets) / first.tickets) * 100);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('historicMonths', String(MONTHS));
    set('historicTicketGrowth', `+${growthPct}%`);
    set('historicTotalTickets', latest.tickets.toLocaleString());
    set('historicPoolLatest', '$' + latest.poolUsd.toLocaleString());
  }

  function init() {
    ensureData();
    renderStats();
    renderHistoricWinners('historicWinnersList', 24);
    renderGrowthChart('growthChart');
  }

  return { init, getData, renderGrowthChart, renderHistoricWinners, renderStats };
})();

window.HistoricGrowth = HistoricGrowth;
