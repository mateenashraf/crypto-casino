/**
 * Wallet-connected player dashboard: wins, losses, charts (includes expired tickets)
 */
const PlayerDashboard = (() => {
  const STORAGE_SLOT = 'starbitz_slot_history';

  let charts = { earnings: null, activity: null };

  function getSlotHistory(wallet) {
    if (!wallet) return [];
    const all = JSON.parse(localStorage.getItem(STORAGE_SLOT) || '[]');
    return all.filter((s) => s.wallet?.toLowerCase() === wallet.toLowerCase());
  }

  function getTickets(wallet) {
    if (!wallet) return [];
    return window.SecureWeb3?.getTicketsByAddress?.(wallet) || [];
  }

  function getWinEntries(wallet) {
    if (!wallet) return [];
    const key = wallet.toLowerCase();
    const short = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`.toLowerCase();
    let winners = [];
    try { winners = JSON.parse(localStorage.getItem('starbitz_draw_winners') || '[]'); } catch { /* */ }
    const myTickets = getTickets(wallet);
    const ticketIds = new Set(myTickets.map((t) => t.id));
    return winners.filter((w) => {
      if (w.fromRealTicket && ticketIds.size > 0) return true;
      const wAddr = (w.winner?.wallet || '').toLowerCase();
      return wAddr === short || wAddr.includes(key.slice(2, 10));
    });
  }

  function computeStats(wallet) {
    const tickets = getTickets(wallet);
    const slots = getSlotHistory(wallet);
    const wins = getWinEntries(wallet);

    const spentTickets = tickets.reduce((s, t) => s + (Number(t.usdPrice) || 0), 0);
    const spentSlots = slots.filter((s) => !s.free).reduce((s, x) => s + (Number(x.betUsd) || 0), 0);
    const totalSpent = spentTickets + spentSlots;

    const slotWon = slots.filter((s) => s.won).reduce((s, x) => s + (Number(x.payoutUsd) || 0), 0);
    const drawWon = wins.reduce((s, w) => s + (Number(w.paidUsd) || Number(w.prize) || 0), 0);
    const totalEarned = slotWon + drawWon;

    const winCount = wins.length + slots.filter((s) => s.won).length;
    const lossCount = slots.filter((s) => !s.won).length + Math.max(0, tickets.length - wins.length);

    const expired = tickets.filter((t) => {
      const age = Date.now() - (t.timestamp || 0);
      return age > 86400000 * 2;
    }).length;

    return {
      tickets: tickets.length,
      expired,
      totalSpent,
      totalEarned,
      net: totalEarned - totalSpent,
      winCount,
      lossCount,
      slots: slots.length,
      ticketsList: tickets,
      slotsList: slots,
      winsList: wins,
    };
  }

  function monthBuckets(wallet) {
    const stats = computeStats(wallet);
    const map = {};
    const add = (ts, spent, earned) => {
      const k = new Date(ts).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      if (!map[k]) map[k] = { spent: 0, earned: 0 };
      map[k].spent += spent;
      map[k].earned += earned;
    };

    stats.ticketsList.forEach((t) => add(t.timestamp, Number(t.usdPrice) || 0, 0));
    stats.slotsList.forEach((s) => add(s.timestamp, s.free ? 0 : Number(s.betUsd) || 0, s.won ? Number(s.payoutUsd) || 0 : 0));
    stats.winsList.forEach((w) => add(w.timestamp, 0, Number(w.paidUsd) || Number(w.prize) || 0));

    const labels = Object.keys(map);
    return {
      labels,
      spent: labels.map((k) => map[k].spent),
      earned: labels.map((k) => map[k].earned),
      net: labels.map((k) => map[k].earned - map[k].spent),
    };
  }

  function renderConnectPrompt() {
    const el = document.getElementById('dashboardContent');
    if (!el) return;
    el.innerHTML = `
      <div class="dashboard-connect">
        <span data-icon="wallet" data-icon-size="48"></span>
        <h3>Connect your wallet</h3>
        <p>See every ticket (including expired draws), slot spins, wins, losses, and net earnings in one place.</p>
        <button type="button" class="btn btn-gold" id="dashboardConnectBtn">Connect Wallet</button>
      </div>`;
    window.Icons?.hydrate?.(el);
    document.getElementById('dashboardConnectBtn')?.addEventListener('click', () => {
      window.AppUI?.openWallet?.();
    });
  }

  function renderDashboard(wallet) {
    const el = document.getElementById('dashboardContent');
    if (!el) return;
    const stats = computeStats(wallet);
    const pending = window.PoolPolicy?.getPendingForWallet?.(wallet) || [];
    const netClass = stats.net >= 0 ? 'positive' : 'negative';

    el.innerHTML = `
      <div class="dashboard-stats-grid">
        <div class="dash-stat"><span>Total spent</span><strong>$${stats.totalSpent.toFixed(2)}</strong></div>
        <div class="dash-stat highlight"><span>Money earned</span><strong>$${stats.totalEarned.toFixed(2)}</strong></div>
        <div class="dash-stat ${netClass}"><span>Net</span><strong>${stats.net >= 0 ? '+' : ''}$${stats.net.toFixed(2)}</strong></div>
        <div class="dash-stat"><span>Wins / Losses</span><strong>${stats.winCount} / ${stats.lossCount}</strong></div>
        <div class="dash-stat"><span>Tickets (incl. expired)</span><strong>${stats.tickets}</strong></div>
        <div class="dash-stat"><span>Slot spins</span><strong>${stats.slots}</strong></div>
      </div>
      ${pending.length ? `<div class="dashboard-pending"><strong>${pending.length} payout(s) awaiting operator approval</strong> (over $1,000)</div>` : ''}
      <div class="dashboard-charts">
        <div class="chart-card"><h4>Earnings vs spend</h4><canvas id="dashEarningsChart" height="200"></canvas></div>
        <div class="chart-card"><h4>Win / loss split</h4><canvas id="dashActivityChart" height="200"></canvas></div>
      </div>
      <div class="dashboard-probability" id="dashProbability"></div>
      <div class="dashboard-tickets">
        <h4>Your tickets (all draws)</h4>
        <div class="dashboard-ticket-list" id="dashTicketList"></div>
      </div>
      ${window.PoolPolicy?.isOperator?.(wallet) ? '<div id="operatorPanel" class="operator-panel"></div>' : ''}
    `;

    renderTicketList(stats.ticketsList);
    renderProbability(stats);
    renderCharts(wallet);
    if (window.PoolPolicy?.isOperator?.(wallet)) renderOperatorPanel();
    window.Icons?.hydrate?.(el);
  }

  function renderTicketList(tickets) {
    const el = document.getElementById('dashTicketList');
    if (!el) return;
    if (!tickets.length) {
      el.innerHTML = '<p class="panel-hint">No tickets yet. Buy lottery entries or play slots &amp; roulette.</p>';
      return;
    }
    el.innerHTML = tickets.slice(0, 30).map((t) => {
      const expired = Date.now() - t.timestamp > 86400000;
      return `
        <div class="dash-ticket-row ${expired ? 'expired' : ''}">
          <span class="dash-ticket-id">${t.id}</span>
          <span>${(t.numbers || []).join(' · ')}</span>
          <span>${t.free ? 'Free' : '$' + (t.usdPrice || 0)}</span>
          <span class="dash-ticket-status">${expired ? 'Expired' : 'Active'}</span>
        </div>`;
    }).join('');
  }

  function renderProbability(stats) {
    const el = document.getElementById('dashProbability');
    if (!el) return;
    const netPositive = stats.net >= 0;
    el.innerHTML = `
      <h4>Understanding your results</h4>
      <p>${window.ProvablyFair?.explainOutcome?.(netPositive, 'lottery') || ''}</p>
      <p class="panel-hint">Every draw publishes a commit hash before numbers are revealed, so anyone can verify results were random.</p>
    `;
  }

  function destroyCharts() {
    Object.values(charts).forEach((c) => c?.destroy?.());
    charts = { earnings: null, activity: null };
  }

  function renderCharts(wallet) {
    if (!window.Chart) return;
    destroyCharts();
    const buckets = monthBuckets(wallet);
    const stats = computeStats(wallet);

    const earningsCanvas = document.getElementById('dashEarningsChart');
    if (earningsCanvas) {
      charts.earnings = new Chart(earningsCanvas, {
        type: 'bar',
        data: {
          labels: buckets.labels.length ? buckets.labels : ['No activity'],
          datasets: [
            { label: 'Spent', data: buckets.spent.length ? buckets.spent : [0], backgroundColor: 'rgba(248,113,113,0.7)' },
            { label: 'Earned', data: buckets.earned.length ? buckets.earned : [0], backgroundColor: 'rgba(74,222,128,0.7)' },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: '#94a3b8' } } },
          scales: {
            x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.06)' } },
          },
        },
      });
    }

    const activityCanvas = document.getElementById('dashActivityChart');
    if (activityCanvas) {
      charts.activity = new Chart(activityCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Wins', 'Losses'],
          datasets: [{
            data: [Math.max(1, stats.winCount), Math.max(1, stats.lossCount)],
            backgroundColor: ['#4ade80', '#f87171'],
          }],
        },
        options: {
          plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } },
        },
      });
    }
  }

  function renderOperatorPanel() {
    const el = document.getElementById('operatorPanel');
    if (!el) return;
    const pending = window.PoolPolicy?.getPendingPayouts?.() || [];
    el.innerHTML = `
      <h4>Operator: pending payouts (&gt; $1,000)</h4>
      ${pending.length ? pending.map((p) => `
        <div class="operator-row" data-id="${p.id}">
          <span>${p.wallet?.slice(0, 10)}… · $${p.usdAmount.toLocaleString()} · ${p.type}</span>
          <button type="button" class="btn btn-gold btn-sm operator-approve">Approve</button>
          <button type="button" class="btn btn-ghost btn-sm operator-reject">Reject</button>
        </div>`).join('') : '<p class="panel-hint">No pending approvals.</p>'}
    `;
    el.querySelectorAll('.operator-approve').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.closest('.operator-row')?.dataset.id;
        const wallet = window.SecureWeb3?.getAddress?.();
        window.PoolPolicy?.resolvePayout?.(id, true, wallet);
        window.AppUI?.toast?.('Payout approved', 'success');
        refresh();
      });
    });
    el.querySelectorAll('.operator-reject').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.closest('.operator-row')?.dataset.id;
        const wallet = window.SecureWeb3?.getAddress?.();
        window.PoolPolicy?.resolvePayout?.(id, false, wallet);
        window.AppUI?.toast?.('Payout rejected', 'info');
        refresh();
      });
    });
  }

  function refresh() {
    const wallet = window.SecureWeb3?.getAddress?.();
    if (!wallet || !window.SecureWeb3?.isConnected?.()) {
      renderConnectPrompt();
      return;
    }
    renderDashboard(wallet);
  }

  function init() {
    refresh();
    window.SecureWeb3?.on?.((event) => {
      if (['connected', 'disconnected', 'ticket-purchased', 'withdraw-success', 'payout-pending'].includes(event)) {
        refresh();
      }
    });
    window.addEventListener('slot-played', () => refresh());
    window.addEventListener('payout-approved', () => refresh());
  }

  return { init, refresh, computeStats, getSlotHistory };
})();

window.PlayerDashboard = PlayerDashboard;
