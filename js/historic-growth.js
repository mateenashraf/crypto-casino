/**
 * Platform history charts - same ledger as live stats (entries, sales, paid)
 */
const HistoricGrowth = (() => {
  let chartInstance = null;

  function getSeriesBundle() {
    const metrics = window.PlatformStats.getLiveMetrics();
    const series = window.PlatformStats.buildMonthSeries(metrics);
    return { metrics, series };
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
            label: 'Lifetime ticket sales ($)',
            data: series.map((s) => s.salesUsd),
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
            pointRadius: 3,
            pointHoverRadius: 5,
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
                return `${ctx.dataset.label}: ${Number(v).toLocaleString()}`;
              },
              afterBody(items) {
                const i = items[0]?.dataIndex;
                if (i == null) return [];
                const row = series[i];
                if (!row) return [];
                return [
                  `Pool in play (live float): ${window.PlatformStats.formatUsd(row.poolUsd)}`,
                  `Platform 5%: ${window.PlatformStats.formatUsd(row.platformUsd)}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', maxRotation: 0 },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            beginAtZero: false,
            title: { display: true, text: 'Entries', color: '#a78bfa', font: { size: 11 } },
            ticks: {
              color: '#a78bfa',
              callback: (v) => {
                if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
                if (v >= 1000) return Math.round(v / 1000) + 'K';
                return v;
              },
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          y1: {
            position: 'right',
            beginAtZero: false,
            title: { display: true, text: 'Sales & payouts ($)', color: '#f5b731', font: { size: 11 } },
            ticks: {
              color: '#f5b731',
              callback: (v) => {
                if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(0) + 'M';
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

  function renderStats() {
    window.PlatformStats.renderPlatformMetrics();
  }

  function refresh() {
    renderStats();
    if (chartInstance) {
      const { series } = getSeriesBundle();
      chartInstance.data.labels = series.map((s) => s.label);
      chartInstance.data.datasets[0].data = series.map((s) => s.tickets);
      chartInstance.data.datasets[1].data = series.map((s) => s.salesUsd);
      if (chartInstance.data.datasets[2]) {
        chartInstance.data.datasets[2].data = series.map((s) => s.paidUsd);
      }
      chartInstance.update('none');
    }
  }

  function init() {
    renderStats();
    renderGrowthChart('growthChart');
    window.addEventListener('lottery-activity', () => refresh());
    window.addEventListener('draw-completed', () => refresh());
    window.addEventListener('pool-updated', () => refresh());
  }

  return { init, refresh, getSeriesBundle, renderStats, renderGrowthChart };
})();

window.HistoricGrowth = HistoricGrowth;
