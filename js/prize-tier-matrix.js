/**
 * 6/49 match-tier prizes: one math model for the odds UI and live payouts.
 *
 * Rules (so the table survives scrutiny):
 * - 6/6 = 100% of that draw’s advertised jackpot (split only if 2-3 tickets hit)
 * - 5/4/3 = published % of that same jackpot (example = % × typical jackpot)
 * - Odds are exact 6-from-49 combinatorics
 * - Chart = typical cash per winning ticket (same numbers as the Example column)
 */
const PrizeTierMatrix = (() => {
  const MAX_RESOLVED_MATCHES = 6;

  /** Exact: C(6,k)*C(43,6-k) / C(49,6) */
  const MATCH_ODDS = {
    6: { label: '1 in 13,983,816', oneIn: 13_983_816, winPct: 0.000007151 },
    5: { label: '1 in 54,201', oneIn: 54_201, winPct: 0.001845 },
    4: { label: '1 in 1,032', oneIn: 1_032, winPct: 0.0969 },
    3: { label: '1 in 57', oneIn: 56.66, winPct: 1.765 },
    2: { label: '1 in 7.6', oneIn: 7.56, winPct: 13.24 },
  };

  /**
   * Per winning ticket, as a share of the advertised jackpot.
   * Must stay in sync with scripts/jackpot-reality.mjs
   * Tuned so 5/6 is always well below the jackpot, and 3/6 is a small cash hit.
   */
  const MATCH_PCT = {
    daily: {
      5: [0.12, 0.20],
      4: [0.03, 0.07],
      3: [0.008, 0.018],
    },
    weekly: {
      5: [0.01, 0.02],
      4: [0.0003, 0.0007],
      3: [0.000012, 0.000028],
    },
    monthly: {
      5: [0.009, 0.018],
      4: [0.00025, 0.00055],
      3: [0.000009, 0.00002],
    },
    quarterly: {
      5: [0.008, 0.016],
      4: [0.0002, 0.00045],
      3: [0.000007, 0.000016],
    },
  };

  const TYPICAL_JP = {
    daily: 3_184,
    weekly: 2_184_750,
    monthly: 5_392_180,
    quarterly: 12_847_390,
  };

  const TOP_LABEL = {
    daily: '~$2,147 to $3,892',
    weekly: '~$1.85M to $5.39M',
    monthly: '~$4.85M to $12.85M',
    quarterly: '~$9.85M to $28.4M',
  };

  const NAMES = {
    daily: 'Daily Draw',
    weekly: 'Weekly Mega',
    monthly: 'Monthly Jackpot',
    quarterly: 'Quarterly Ultra',
  };

  function formatUsd(n) {
    const v = Math.round(Number(n) || 0);
    if (window.DrawEngine?.formatUsd) return window.DrawEngine.formatUsd(v);
    if (v >= 1_000_000) {
      const m = v / 1_000_000;
      const s = m >= 10 ? m.toFixed(2) : m.toFixed(3);
      return `$${s.replace(/\.?0+$/, '')}M`;
    }
    return `$${v.toLocaleString('en-US')}`;
  }

  function formatPctBand(lo, hi) {
    const f = (x) => {
      const p = x * 100;
      if (p >= 1) return `${p.toFixed(1)}%`;
      if (p >= 0.01) return `${p.toFixed(2)}%`;
      return `${p.toFixed(3)}%`;
    };
    return `${f(lo)} to ${f(hi)}`;
  }

  function exampleBand(typical, lo, hi) {
    return `${formatUsd(typical * lo)} to ${formatUsd(typical * hi)}`;
  }

  function midPct(band) {
    return (band[0] + band[1]) / 2;
  }

  function buildMatrix() {
    const out = {};
    Object.keys(NAMES).forEach((id) => {
      const typical = TYPICAL_JP[id];
      const pct = MATCH_PCT[id];
      out[id] = {
        name: NAMES[id],
        topPrizeLabel: TOP_LABEL[id],
        typicalJackpot: typical,
        rows: [
          {
            matches: 6,
            prize: '100% of jackpot',
            prizeShort: 'Full jackpot',
            type: 'jackpot',
            jackpotPct: [1, 1],
            example: formatUsd(typical),
            exampleMid: typical,
            odds: MATCH_ODDS[6].label,
          },
          {
            matches: 5,
            prize: `${formatPctBand(pct[5][0], pct[5][1])} of jackpot`,
            prizeShort: formatPctBand(pct[5][0], pct[5][1]),
            type: 'cash',
            jackpotPct: pct[5],
            example: exampleBand(typical, pct[5][0], pct[5][1]),
            exampleMid: Math.round(typical * midPct(pct[5])),
            odds: MATCH_ODDS[5].label,
          },
          {
            matches: 4,
            prize: `${formatPctBand(pct[4][0], pct[4][1])} of jackpot`,
            prizeShort: formatPctBand(pct[4][0], pct[4][1]),
            type: 'cash',
            jackpotPct: pct[4],
            example: exampleBand(typical, pct[4][0], pct[4][1]),
            exampleMid: Math.round(typical * midPct(pct[4])),
            odds: MATCH_ODDS[4].label,
          },
          {
            matches: 3,
            prize: `${formatPctBand(pct[3][0], pct[3][1])} of jackpot`,
            prizeShort: formatPctBand(pct[3][0], pct[3][1]),
            type: 'cash',
            jackpotPct: pct[3],
            example: exampleBand(typical, pct[3][0], pct[3][1]),
            exampleMid: Math.round(typical * midPct(pct[3])),
            odds: MATCH_ODDS[3].label,
          },
          {
            matches: 2,
            prize: 'No cash prize',
            prizeShort: 'No prize',
            type: 'none',
            jackpotPct: null,
            example: '-',
            exampleMid: 0,
            odds: MATCH_ODDS[2].label,
          },
        ],
      };
    });
    return out;
  }

  const MATRIX = buildMatrix();

  let chartInstance = null;
  let selectedDrawId = 'monthly';

  function countMatches(ticketNumbers, winningNumbers) {
    if (!Array.isArray(ticketNumbers) || !Array.isArray(winningNumbers)) return 0;
    const winSet = new Set(winningNumbers);
    return ticketNumbers.filter((n) => winSet.has(n)).length;
  }

  function capMatchCount(matchCount) {
    const n = Math.floor(Number(matchCount) || 0);
    return Math.min(MAX_RESOLVED_MATCHES, Math.max(0, n));
  }

  function getRow(drawId, matchCount) {
    const tier = MATRIX[drawId] || MATRIX.monthly;
    const capped = capMatchCount(matchCount);
    return tier.rows.find((r) => r.matches === capped)
      || tier.rows.find((r) => r.type === 'none');
  }

  function messyCash(amount) {
    let n = Math.round(amount);
    if (n >= 5_000 && (n % 1000 < 30 || n % 1000 > 970)) n += 47 + Math.floor(Math.random() * 400);
    else if (n >= 200 && n % 100 === 0) n += 13 + Math.floor(Math.random() * 60);
    else if (n % 10 === 0) n += 1 + Math.floor(Math.random() * 8);
    return Math.max(1, n);
  }

  function cashFromJackpotPct(drawId, matchCount, advertisedPrize) {
    const pct = MATCH_PCT[drawId]?.[matchCount];
    if (!pct || !(advertisedPrize > 0)) return 0;
    const p = pct[0] + Math.random() * (pct[1] - pct[0]);
    return messyCash(advertisedPrize * p);
  }

  function resolveOutcome(drawId, matchCount, advertisedPrize) {
    const effectiveMatches = capMatchCount(matchCount);
    const row = getRow(drawId, effectiveMatches);
    if (!row || row.type === 'none' || effectiveMatches < 3) {
      return {
        prizeType: 'none',
        prizeLabel: 'No prize',
        displayUsd: 0,
        isJackpot: false,
        matchCount: effectiveMatches,
        freeQty: 0,
      };
    }

    if (row.type === 'jackpot' || effectiveMatches === 6) {
      const cap = Math.round(advertisedPrize);
      return {
        prizeType: 'cash',
        prizeLabel: formatUsd(cap),
        displayUsd: cap,
        isJackpot: true,
        matchCount: 6,
        freeQty: 0,
      };
    }

    const amt = cashFromJackpotPct(drawId, effectiveMatches, advertisedPrize);
    return {
      prizeType: 'cash',
      prizeLabel: formatUsd(amt),
      displayUsd: amt,
      isJackpot: false,
      matchCount: effectiveMatches,
      freeQty: 0,
    };
  }

  function pickBestTicketByMatches(tickets, winningNumbers) {
    if (!tickets?.length) return null;
    const scored = tickets
      .map((t) => ({ ticket: t, matches: countMatches(t.numbers, winningNumbers) }))
      .filter((x) => x.matches >= 3);
    if (!scored.length) return null;
    const best = Math.max(...scored.map((s) => s.matches));
    const top = scored.filter((s) => s.matches === best);
    return top[Math.floor(Math.random() * top.length)];
  }

  function renderMatrixTable(drawId) {
    const el = document.getElementById('matchTierTableBody');
    if (!el) return;
    const tier = MATRIX[drawId] || MATRIX.monthly;
    el.innerHTML = tier.rows.map((row) => {
      const matchLabel = `${row.matches} of 6`;
      const typeClass = row.type === 'jackpot' ? 'match-prize-jackpot'
        : row.type === 'cash' ? 'match-prize-cash' : 'match-prize-none';
      const check = row.type === 'cash' && row.jackpotPct
        ? exampleBand(tier.typicalJackpot, row.jackpotPct[0], row.jackpotPct[1])
        : row.example;
      return `<tr>
        <td><span class="match-ball-count">${matchLabel}</span></td>
        <td class="match-odds-cell">${row.odds}</td>
        <td class="${typeClass}">${row.prize}</td>
        <td class="match-example-cell">${check}</td>
      </tr>`;
    }).join('');
  }

  function renderPoolChart(drawId) {
    const canvas = document.getElementById('matchTierChart');
    if (!canvas || !window.Chart) return;

    const tier = MATRIX[drawId] || MATRIX.monthly;
    const rows = tier.rows.filter((r) => r.exampleMid > 0);
    const colors = {
      daily: ['#38bdf8', '#7dd3fc', '#0ea5e9', '#0284c7'],
      weekly: ['#34d399', '#6ee7b7', '#10b981', '#059669'],
      monthly: ['#fb923c', '#fdba74', '#f97316', '#ea580c'],
      quarterly: ['#e879f9', '#f0abfc', '#d946ef', '#c026d3'],
    };
    const palette = colors[drawId] || colors.monthly;

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((r) => `${r.matches} of 6`),
        datasets: [{
          label: 'Typical payout',
          data: rows.map((r) => r.exampleMid),
          backgroundColor: rows.map((_, i) => palette[i % palette.length]),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0]?.label || '',
              label(ctx) {
                const row = rows[ctx.dataIndex];
                return [
                  `Typical: ${formatUsd(row.exampleMid)}`,
                  row.prize,
                  `Range: ${row.example}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            type: 'logarithmic',
            ticks: {
              color: '#94a3b8',
              callback: (v) => {
                const n = Number(v);
                if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
                if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
                return `$${n}`;
              },
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
            title: {
              display: true,
              text: 'Typical payout per winning ticket (log scale)',
              color: '#64748b',
              font: { size: 11 },
            },
          },
          y: {
            ticks: { color: '#e2e8f0', font: { weight: '500' } },
            grid: { display: false },
          },
        },
      },
    });
  }

  function setSelectedDraw(drawId) {
    if (!MATRIX[drawId]) return;
    selectedDrawId = drawId;
    document.querySelectorAll('.match-tier-draw-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.drawId === drawId);
    });
    const summary = document.getElementById('matchTierDrawSummary');
    if (summary) {
      const tier = MATRIX[drawId];
      summary.textContent = `${tier.name} · typical jackpot ${formatUsd(tier.typicalJackpot)}`;
    }
    renderMatrixTable(drawId);
    renderPoolChart(drawId);
  }

  function bindDrawSelector() {
    document.querySelectorAll('.match-tier-draw-btn').forEach((btn) => {
      btn.addEventListener('click', () => setSelectedDraw(btn.dataset.drawId));
    });
    window.addEventListener('draw-selected', (ev) => {
      if (ev.detail?.id) setSelectedDraw(ev.detail.id);
    });
  }

  function init() {
    bindDrawSelector();
    const initial = window.DrawEngine?.getSelectedDrawId?.() || 'monthly';
    setSelectedDraw(MATRIX[initial] ? initial : 'monthly');
  }

  return {
    MATRIX,
    MATCH_ODDS,
    MATCH_PCT,
    MAX_RESOLVED_MATCHES,
    capMatchCount,
    countMatches,
    getRow,
    resolveOutcome,
    cashFromJackpotPct,
    pickBestTicketByMatches,
    init,
    setSelectedDraw,
    renderMatrixTable,
    renderPoolChart,
  };
})();

window.PrizeTierMatrix = PrizeTierMatrix;
