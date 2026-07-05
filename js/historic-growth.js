/**
 * 14 months of platform growth — aligned with live stats bar & pool figures
 */
const HistoricGrowth = (() => {
  let chartInstance = null;

  function getSeriesBundle() {
    const metrics = window.PlatformStats.getLiveMetrics();
    const series = window.PlatformStats.buildMonthSeries(metrics);
    const winners = window.PlatformStats.buildHistoricWinners(series);
    return { metrics, series, winners };
  }

  function renderGrowthChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return null;

    const { series } = getSeriesBundle();

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: series.map((s) => s.label),
        datasets: [
          {
            label: 'Total entries sold',
            data: series.map((s) => s.tickets),
            borderColor: '#a78bfa',
            backgroundColor: 'rgba(167,139,250,0.14)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5,
            yAxisID: 'y',
          },
          {
            label: 'Pool in play ($)',
            data: series.map((s) => s.poolUsd),
            borderColor: '#f5b731',
            backgroundColor: 'rgba(245,183,49,0.08)',
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5,
            yAxisID: 'y1',
          },
          {
            label: 'Paid to winners ($)',
            data: series.map((s) => s.paidUsd),
            borderColor: '#34d399',
            backgroundColor: 'rgba(52,211,153,0.06)',
            tension: 0.35,
            pointRadius: 2,
            pointHoverRadius: 4,
            borderDash: [4, 3],
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#94a3b8', boxWidth: 12, padding: 14 },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const v = ctx.parsed.y;
                if (ctx.datasetIndex >= 1) {
                  return `${ctx.dataset.label}: ${window.PlatformStats.formatUsd(v)}`;
                }
                return `${ctx.dataset.label}: ${v.toLocaleString()}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#64748b', maxRotation: 45, font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            position: 'left',
            title: { display: true, text: 'Entries', color: '#a78bfa', font: { size: 11 } },
            ticks: {
              color: '#94a3b8',
              callback: (v) => v.toLocaleString(),
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          y1: {
            position: 'right',
            title: { display: true, text: 'Pool & payouts ($)', color: '#f5b731', font: { size: 11 } },
            ticks: {
              color: '#f5b731',
              callback: (v) => {
                if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
                if (v >= 1000) return '$' + Math.round(v / 1000) + 'K';
                return '$' + v;
              },
            },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });

    return chartInstance;
  }

  function renderHistoricWinners(containerId, limit = 24) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const { winners } = getSeriesBundle();
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
    window.PlatformStats.renderPlatformMetrics();
  }

  function refresh() {
    renderStats();
    renderHistoricWinners('historicWinnersList', 24);
    if (chartInstance) {
      const { series } = getSeriesBundle();
      chartInstance.data.labels = series.map((s) => s.label);
      chartInstance.data.datasets[0].data = series.map((s) => s.tickets);
      chartInstance.data.datasets[1].data = series.map((s) => s.poolUsd);
      if (chartInstance.data.datasets[2]) {
        chartInstance.data.datasets[2].data = series.map((s) => s.paidUsd);
      }
      chartInstance.update('none');
    }
  }

  function init() {
    renderStats();
    renderHistoricWinners('historicWinnersList', 24);
    renderGrowthChart('growthChart');

    window.addEventListener('lottery-activity', () => refresh());
    window.addEventListener('draw-completed', () => refresh());
    window.addEventListener('pool-updated', () => refresh());
  }

  return { init, refresh, getSeriesBundle, renderStats, renderGrowthChart };
})();

window.HistoricGrowth = HistoricGrowth;
