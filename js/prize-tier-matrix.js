/**
 * 6/49 match-tier prizes — shared rules for odds UI and draw payouts
 */
const PrizeTierMatrix = (() => {
  /** Real ticket payouts never resolve above this match tier */
  const MAX_RESOLVED_MATCHES = 4;
  /** Approximate odds of matching exactly k numbers (6 picks from 49) */
  const MATCH_ODDS = {
    6: { label: '1 in 13.98M', winPct: 0.0000072 },
    5: { label: '1 in 54,201', winPct: 0.00185 },
    4: { label: '1 in 1,032', winPct: 0.0969 },
    3: { label: '1 in 57', winPct: 1.76 },
    2: { label: '1 in 8', winPct: 12.5 },
  };

  const MATRIX = {
    daily: {
      name: 'Daily Draw',
      topPrizeLabel: '$2K – $3.5K',
      rows: [
        { matches: 6, prize: 'Top prize (up to $3,500)', type: 'jackpot', poolShare: 48, cashMin: 800, cashMax: 3500, freeQty: 0 },
        { matches: 5, prize: '$25 – $350 cash', type: 'cash', poolShare: 30, cashMin: 25, cashMax: 350, freeQty: 0 },
        { matches: 4, prize: '2 Free Tickets', type: 'free_tickets', poolShare: 14, freeQty: 2 },
        { matches: 3, prize: '1 Free Ticket', type: 'free_tickets', poolShare: 8, freeQty: 1 },
        { matches: 2, prize: 'No prize — keep playing', type: 'none', poolShare: 0, freeQty: 0 },
      ],
    },
    weekly: {
      name: 'Weekly Mega',
      topPrizeLabel: '$2,000,000',
      rows: [
        { matches: 6, prize: 'Top prize (up to $2M advertised)', type: 'jackpot', poolShare: 58, cashMin: 5000, cashMax: 2_000_000, freeQty: 0 },
        { matches: 5, prize: '$500 – $5,000 cash', type: 'cash', poolShare: 24, cashMin: 500, cashMax: 5000, freeQty: 0 },
        { matches: 4, prize: '2 Free Tickets', type: 'free_tickets', poolShare: 12, freeQty: 2 },
        { matches: 3, prize: '1 Free Ticket', type: 'free_tickets', poolShare: 5, freeQty: 1 },
        { matches: 2, prize: 'No prize — keep playing', type: 'none', poolShare: 1, freeQty: 0 },
      ],
    },
    monthly: {
      name: 'Monthly Jackpot',
      topPrizeLabel: '$5,000,000',
      rows: [
        { matches: 6, prize: 'Top prize (up to $5M advertised)', type: 'jackpot', poolShare: 65, cashMin: 10_000, cashMax: 5_000_000, freeQty: 0 },
        { matches: 5, prize: '$1,000 – $25,000 cash', type: 'cash', poolShare: 20, cashMin: 1000, cashMax: 25_000, freeQty: 0 },
        { matches: 4, prize: '3 Free Tickets', type: 'free_tickets', poolShare: 9, freeQty: 3 },
        { matches: 3, prize: '2 Free Tickets', type: 'free_tickets', poolShare: 5, freeQty: 2 },
        { matches: 2, prize: '1 Free Ticket', type: 'free_tickets', poolShare: 1, freeQty: 1 },
      ],
    },
    quarterly: {
      name: 'Quarterly Ultra',
      topPrizeLabel: '$10,000,000',
      rows: [
        { matches: 6, prize: 'Top prize (up to $10M advertised)', type: 'jackpot', poolShare: 70, cashMin: 25_000, cashMax: 10_000_000, freeQty: 0 },
        { matches: 5, prize: '$2,500 – $50,000 cash', type: 'cash', poolShare: 18, cashMin: 2500, cashMax: 50_000, freeQty: 0 },
        { matches: 4, prize: '3 Free Tickets', type: 'free_tickets', poolShare: 7, freeQty: 3 },
        { matches: 3, prize: '2 Free Tickets', type: 'free_tickets', poolShare: 4, freeQty: 2 },
        { matches: 2, prize: '1 Free Ticket', type: 'free_tickets', poolShare: 1, freeQty: 1 },
      ],
    },
  };

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
    return tier.rows.find((r) => r.matches === capped) || tier.rows.find((r) => r.type === 'none');
  }

  function formatUsd(n) {
    if (window.DrawEngine?.formatUsd) return window.DrawEngine.formatUsd(n);
    return '$' + Math.round(n).toLocaleString();
  }

  function lerpCash(min, max, poolUsd) {
    const t = Math.min(1, Math.max(0, (poolUsd - 500) / 12000));
    return Math.round(min + (max - min) * (0.35 + t * 0.65));
  }

  /** Build draw-engine outcome from match count */
  function resolveOutcome(drawId, matchCount, advertisedPrize, drawPoolUsd = 0) {
    const effectiveMatches = capMatchCount(matchCount);
    const row = getRow(drawId, effectiveMatches);
    if (!row || row.type === 'none') {
      return {
        prizeType: 'none',
        prizeLabel: 'No prize',
        displayUsd: 0,
        isJackpot: false,
        matchCount: effectiveMatches,
        freeQty: 0,
      };
    }

    if (row.type === 'free_tickets') {
      const qty = row.freeQty || 1;
      return {
        prizeType: 'free_ticket',
        prizeLabel: `${qty} Free Ticket${qty > 1 ? 's' : ''}`,
        displayUsd: qty,
        isJackpot: false,
        matchCount: effectiveMatches,
        freeQty: qty,
      };
    }

    if (row.type === 'jackpot') {
      const cap = Math.min(advertisedPrize, row.cashMax || advertisedPrize);
      return {
        prizeType: 'cash',
        prizeLabel: formatUsd(cap),
        displayUsd: cap,
        isJackpot: true,
        matchCount: effectiveMatches,
        freeQty: 0,
      };
    }

    const amt = lerpCash(row.cashMin || 10, row.cashMax || 500, drawPoolUsd);
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
      .map((t) => ({ ticket: t, matches: capMatchCount(countMatches(t.numbers, winningNumbers)) }))
      .filter((x) => x.matches >= 2 && x.matches <= MAX_RESOLVED_MATCHES);
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
      const matchLabel = row.matches === 6 ? '6 of 6' : `${row.matches} of 6`;
      const typeClass = row.type === 'jackpot' ? ' match-prize-jackpot'
        : row.type === 'free_tickets' ? ' match-prize-ticket'
          : row.type === 'cash' ? ' match-prize-cash' : ' match-prize-none';
      return `<tr>
        <td><span class="match-ball-count">${matchLabel}</span></td>
        <td class="${typeClass.trim()}">${row.prize}</td>
        <td>${row.poolShare > 0 ? `${row.poolShare}%` : '—'}</td>
      </tr>`;
    }).join('');
  }

  function renderPoolChart(drawId) {
    const canvas = document.getElementById('matchTierChart');
    if (!canvas || !window.Chart) return;

    const tier = MATRIX[drawId] || MATRIX.monthly;
    const rows = tier.rows.filter((r) => r.poolShare > 0);
    const colors = ['#f5b731', '#a78bfa', '#34d399', '#60a5fa', '#94a3b8'];

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((r) => (r.matches === 6 ? '6 of 6' : `${r.matches} of 6`)),
        datasets: [{
          label: 'Prize tier',
          data: rows.map((r) => r.poolShare),
          backgroundColor: rows.map((_, i) => colors[i % colors.length]),
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
                return row.prize;
              },
            },
          },
        },
        scales: {
          x: {
            max: 80,
            ticks: { color: '#94a3b8', callback: (v) => `${v}%` },
            grid: { color: 'rgba(255,255,255,0.06)' },
            title: { display: true, text: 'Prize pool share', color: '#64748b', font: { size: 11, family: "'DM Sans', sans-serif" } },
          },
          y: {
            ticks: { color: '#e2e8f0', font: { weight: '500', family: "'DM Sans', sans-serif" } },
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
      summary.textContent = `${tier.name} · top prize ${tier.topPrizeLabel}`;
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
    MAX_RESOLVED_MATCHES,
    capMatchCount,
    countMatches,
    getRow,
    resolveOutcome,
    pickBestTicketByMatches,
    init,
    setSelectedDraw,
    renderMatrixTable,
    renderPoolChart,
  };
})();

window.PrizeTierMatrix = PrizeTierMatrix;
