/**
 * Wallet-connected player dashboard - wins, perks, and encouraging activity (no loss tracking)
 */
const PlayerDashboard = (() => {
  const STORAGE_SLOT = 'slot_history';
  const STORAGE_ROULETTE = 'roulette_history';
  const STORAGE_SLOT_FREE = 'slot_free_daily';
  const STORAGE_ROULETTE_FREE = 'roulette_free_daily';
  const FREE_SPINS_PER_DAY = 3;

  let charts = { wins: null, byGame: null };

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function getSlotHistory(wallet) {
    if (!wallet) return [];
    const all = SecureStorage.getJSON(STORAGE_SLOT, []);
    return all.filter((s) => s.wallet?.toLowerCase() === wallet.toLowerCase());
  }

  function getRouletteHistory(wallet) {
    if (!wallet) return [];
    const all = SecureStorage.getJSON(STORAGE_ROULETTE, []);
    return all.filter((s) => s.wallet?.toLowerCase() === wallet.toLowerCase());
  }

  function getTickets(wallet) {
    if (!wallet) return [];
    return window.SecureWeb3?.getTicketsByAddress?.(wallet) || [];
  }

  function getDrawWins(wallet) {
    if (!wallet) return [];
    const key = wallet.toLowerCase();
    const short = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`.toLowerCase();
    const winners = SecureStorage.getJSON('draw_winners', []);
    const myTickets = getTickets(wallet);
    const ticketIds = new Set(myTickets.map((t) => t.id));
    return winners.filter((w) => {
      if (w.fromRealTicket && ticketIds.size > 0) return true;
      const wAddr = (w.winner?.wallet || '').toLowerCase();
      return wAddr === short || wAddr.includes(key.slice(2, 10));
    });
  }

  function loadFreePerks(wallet) {
    const read = (key) => {
      try {
        const data = SecureStorage.getJSON(key, {});
        if (data.day !== todayKey()) return { used: 0 };
        return { used: data.freeSpinsUsed || 0 };
      } catch {
        return { used: 0 };
      }
    };
    return {
      slotSpinsLeft: Math.max(0, FREE_SPINS_PER_DAY - read(STORAGE_SLOT_FREE).used),
      rouletteSpinsLeft: Math.max(0, FREE_SPINS_PER_DAY - read(STORAGE_ROULETTE_FREE).used),
      freeLotteryTickets: window.SecureWeb3?.getFreeTicketBalance?.(wallet) || 0,
    };
  }

  function buildRecentWins(wallet, slots, roulette, drawWins) {
    const items = [];
    slots.filter((s) => s.won).forEach((s) => {
      items.push({
        type: 'slots',
        label: s.free ? 'Free slot win' : 'Slots jackpot',
        amount: Number(s.payoutUsd) || 0,
        detail: (s.reels || []).join(' · ') || 'Three of a kind',
        timestamp: s.timestamp || 0,
      });
    });
    roulette.filter((r) => r.won).forEach((r) => {
      items.push({
        type: 'roulette',
        label: r.free ? 'Free roulette win' : 'Roulette hit',
        amount: Number(r.payoutUsd) || 0,
        detail: `${r.betType || 'bet'} on ${r.result}`,
        timestamp: r.timestamp || 0,
      });
    });
    drawWins.forEach((w) => {
      items.push({
        type: 'lottery',
        label: w.prizeType === 'free_ticket' ? 'Bonus lottery ticket' : (w.drawName || 'Draw win'),
        amount: Number(w.paidUsd) || Number(w.prize) || 0,
        detail: w.drawName || 'Scheduled draw',
        timestamp: w.timestamp || 0,
      });
    });
    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 12);
  }

  function welcomeMessage(stats) {
    if (stats.winCount > 0 && stats.totalWon >= 100) {
      return `You have ${stats.winCount} win${stats.winCount === 1 ? '' : 's'} on record - keep the momentum going!`;
    }
    if (stats.winCount > 0) {
      return 'Nice work - every win counts. Your next big hit could be right around the corner.';
    }
    if (stats.activeTickets > 0) {
      return `You have ${stats.activeTickets} ticket${stats.activeTickets === 1 ? '' : 's'} in upcoming draws. Good luck!`;
    }
    if (stats.gamesPlayed > 0) {
      return 'You are in the game - grab a free spin or pick your lucky numbers for the next draw.';
    }
    return 'Welcome! Connect, claim your daily free spins, and pick six numbers for the next draw.';
  }

  function computeStats(wallet) {
    const tickets = getTickets(wallet);
    const slots = getSlotHistory(wallet);
    const roulette = getRouletteHistory(wallet);
    const drawWins = getDrawWins(wallet);

    const slotWon = slots.filter((s) => s.won).reduce((s, x) => s + (Number(x.payoutUsd) || 0), 0);
    const rouletteWon = roulette.filter((r) => r.won).reduce((s, x) => s + (Number(x.payoutUsd) || 0), 0);
    const drawWon = drawWins.reduce((s, w) => s + (Number(w.paidUsd) || Number(w.prize) || 0), 0);
    const totalWon = slotWon + rouletteWon + drawWon;

    const winCount = drawWins.length + slots.filter((s) => s.won).length + roulette.filter((r) => r.won).length;
    const activeTickets = tickets.filter((t) => Date.now() - (t.timestamp || 0) <= 86400000 * 2).length;
    const perks = loadFreePerks(wallet);
    const recentWins = buildRecentWins(wallet, slots, roulette, drawWins);

    const allWinAmounts = recentWins.map((w) => w.amount).filter((n) => n > 0);
    const biggestWin = allWinAmounts.length ? Math.max(...allWinAmounts) : 0;

    return {
      tickets: tickets.length,
      activeTickets,
      totalWon,
      winCount,
      slotSpins: slots.length,
      rouletteSpins: roulette.length,
      gamesPlayed: slots.length + roulette.length,
      slotWins: slots.filter((s) => s.won).length,
      rouletteWins: roulette.filter((r) => r.won).length,
      drawWins: drawWins.length,
      biggestWin,
      recentWins,
      perks,
      ticketsList: tickets,
      slotsList: slots,
      rouletteList: roulette,
      winsList: drawWins,
    };
  }

  function monthWinBuckets(wallet) {
    const stats = computeStats(wallet);
    const map = {};
    const add = (ts, earned) => {
      const k = new Date(ts).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      if (!map[k]) map[k] = 0;
      map[k] += earned;
    };

    stats.slotsList.filter((s) => s.won).forEach((s) => add(s.timestamp, Number(s.payoutUsd) || 0));
    stats.rouletteList.filter((r) => r.won).forEach((r) => add(r.timestamp, Number(r.payoutUsd) || 0));
    stats.winsList.forEach((w) => add(w.timestamp, Number(w.paidUsd) || Number(w.prize) || 0));

    const labels = Object.keys(map);
    return {
      labels,
      earned: labels.map((k) => map[k]),
    };
  }

  function formatUsd(n) {
    return window.TicketPricing?.formatUsd?.(n) || `$${Number(n).toFixed(2)}`;
  }

  function scrollTo(hash) {
    window.AppUI?.scrollToSection?.(hash);
  }

  function renderConnectPrompt() {
    const el = document.getElementById('dashboardContent');
    if (!el) return;
    el.innerHTML = `
      <div class="dashboard-connect">
        <span data-icon="trophy" data-icon-size="48"></span>
        <h3>Your wins &amp; perks hub</h3>
        <p>Connect your wallet to track winnings, active lottery entries, daily free spins, and your full ticket history - all in one encouraging place.</p>
        <button type="button" class="btn btn-gold" id="dashboardConnectBtn">Connect Wallet</button>
      </div>`;
    window.Icons?.hydrate?.(el);
    document.getElementById('dashboardConnectBtn')?.addEventListener('click', () => {
      window.AppUI?.openWallet?.();
    });
  }

  function renderPerks(stats) {
    const { perks } = stats;
    const totalFree = perks.slotSpinsLeft + perks.rouletteSpinsLeft + perks.freeLotteryTickets;
    if (!totalFree) {
      return `
        <div class="dashboard-perks dashboard-perks-muted">
          <h4><span data-icon="gift" data-icon-size="16"></span> Daily perks used - come back tomorrow</h4>
          <p>Free spins reset every day. In the meantime, your casino balance is ready for slots and roulette.</p>
        </div>`;
    }
    return `
      <div class="dashboard-perks">
        <h4><span data-icon="gift" data-icon-size="16"></span> Free perks waiting for you</h4>
        <div class="dashboard-perk-chips">
          ${perks.slotSpinsLeft ? `<span class="dash-perk-chip">${perks.slotSpinsLeft} slot spin${perks.slotSpinsLeft === 1 ? '' : 's'}</span>` : ''}
          ${perks.rouletteSpinsLeft ? `<span class="dash-perk-chip">${perks.rouletteSpinsLeft} roulette spin${perks.rouletteSpinsLeft === 1 ? '' : 's'}</span>` : ''}
          ${perks.freeLotteryTickets ? `<span class="dash-perk-chip">${perks.freeLotteryTickets} free ticket${perks.freeLotteryTickets === 1 ? '' : 's'}</span>` : ''}
        </div>
        <div class="dashboard-quick-actions">
          ${perks.slotSpinsLeft ? '<button type="button" class="btn btn-outline btn-sm" data-dash-go="#slots">Claim slot spins</button>' : ''}
          ${perks.rouletteSpinsLeft ? '<button type="button" class="btn btn-outline btn-sm" data-dash-go="#roulette">Claim roulette spins</button>' : ''}
          ${perks.freeLotteryTickets ? '<button type="button" class="btn btn-outline btn-sm" data-dash-go="#lottery">Redeem free ticket</button>' : ''}
        </div>
      </div>`;
  }

  function renderWinsFeed(recentWins) {
    if (!recentWins.length) {
      return `
        <div class="dashboard-wins-feed dashboard-wins-empty">
          <h4><span data-icon="sparkles" data-icon-size="16"></span> Recent wins</h4>
          <p>Your wins will show up here - lottery draws, slot matches, and roulette hits. Try a free spin to get started!</p>
        </div>`;
    }
    const iconFor = { slots: 'cherry', roulette: 'circle-dot', lottery: 'trophy' };
    return `
      <div class="dashboard-wins-feed">
        <h4><span data-icon="trophy" data-icon-size="16"></span> Recent wins</h4>
        <ul class="dash-wins-list">
          ${recentWins.map((w) => `
            <li class="dash-win-item dash-win-${w.type}">
              <span class="dash-win-icon" data-icon="${iconFor[w.type] || 'star'}" data-icon-size="14"></span>
              <div class="dash-win-body">
                <strong>${w.label}</strong>
                <span>${w.detail}</span>
              </div>
              ${w.amount > 0 ? `<span class="dash-win-amount">+${formatUsd(w.amount)}</span>` : '<span class="dash-win-amount dash-win-bonus">Bonus</span>'}
            </li>`).join('')}
        </ul>
      </div>`;
  }

  function renderDashboard(wallet) {
    const el = document.getElementById('dashboardContent');
    if (!el) return;
    const stats = computeStats(wallet);
    const selectedDraw = window.DrawEngine?.getSelectedDraw?.();

    el.innerHTML = `
      <div class="dashboard-welcome">
        <p>${welcomeMessage(stats)}</p>
      </div>
      <div class="dashboard-stats-grid">
        <div class="dash-stat dash-stat-hero highlight">
          <span>Total winnings</span>
          <strong>${formatUsd(stats.totalWon)}</strong>
        </div>
        <div class="dash-stat"><span>Wins</span><strong>${stats.winCount}</strong></div>
        <div class="dash-stat"><span>Active entries</span><strong>${stats.activeTickets}</strong></div>
        <div class="dash-stat"><span>Games played</span><strong>${stats.gamesPlayed}</strong></div>
        ${stats.biggestWin > 0 ? `<div class="dash-stat"><span>Biggest win</span><strong>${formatUsd(stats.biggestWin)}</strong></div>` : ''}
        <div class="dash-stat"><span>Tickets on file</span><strong>${stats.tickets}</strong></div>
      </div>
      ${renderPerks(stats)}
      ${stats.winCount > 0 ? `<div class="dashboard-pending"><strong>Win on the way!</strong> Your winnings are being sent to your wallet - most players receive funds within a few minutes.</div>` : ''}
      <div class="dashboard-quick-actions dashboard-quick-actions-main">
        <button type="button" class="btn btn-gold btn-sm" data-dash-go="#lottery">Buy lottery ticket</button>
        <button type="button" class="btn btn-outline btn-sm" data-dash-go="#slots">Play slots</button>
        <button type="button" class="btn btn-outline btn-sm" data-dash-go="#roulette">Spin roulette</button>
      </div>
      ${renderWinsFeed(stats.recentWins)}
      <div class="dashboard-charts">
        <div class="chart-card chart-card-wide"><h4>Winnings over time</h4><canvas id="dashWinsChart" height="180"></canvas></div>
        <div class="chart-card"><h4>Wins by game</h4><canvas id="dashByGameChart" height="180"></canvas></div>
      </div>
      <div class="dashboard-encourage" id="dashEncourage"></div>
      ${selectedDraw ? `
        <div class="dashboard-next-draw">
          <h4><span data-icon="calendar" data-icon-size="16"></span> Next up: ${selectedDraw.name}</h4>
          <p class="panel-hint">You have ${stats.activeTickets} active ticket${stats.activeTickets === 1 ? '' : 's'} across all draws. Every entry is a fresh chance.</p>
        </div>` : ''}
      <div class="dashboard-tickets">
        <h4>Your lottery tickets</h4>
        <div class="dashboard-ticket-list" id="dashTicketList"></div>
      </div>
    `;

    el.querySelectorAll('[data-dash-go]').forEach((btn) => {
      btn.addEventListener('click', () => scrollTo(btn.dataset.dashGo));
    });

    renderTicketList(stats.ticketsList);
    renderEncouragement(stats);
    renderCharts(wallet, stats);
    window.Icons?.hydrate?.(el);
  }

  function renderTicketList(tickets) {
    const el = document.getElementById('dashTicketList');
    if (!el) return;
    if (!tickets.length) {
      el.innerHTML = '<p class="panel-hint">No tickets yet - pick six numbers and join the next draw, or claim a free bonus entry on the casino floor.</p>';
      return;
    }
    el.innerHTML = tickets.slice(0, 30).map((t) => {
      const expired = Date.now() - t.timestamp > 86400000 * 2;
      const active = !expired;
      return `
        <div class="dash-ticket-row ${expired ? 'expired' : 'active'}">
          <span class="dash-ticket-id">${t.id}</span>
          <span>${(t.numbers || []).join(' · ')}</span>
          <span>${t.free ? 'Free bonus' : formatUsd(t.usdPrice || 0)}</span>
          <span class="dash-ticket-status">${active ? 'In draw' : 'Archived'}</span>
        </div>`;
    }).join('');
  }

  function renderEncouragement(stats) {
    const el = document.getElementById('dashEncourage');
    if (!el) return;
    const tips = [
      stats.activeTickets
        ? `You are entered in upcoming draws with ${stats.activeTickets} ticket${stats.activeTickets === 1 ? '' : 's'} - results are provably fair and verified on-chain.`
        : 'Pick six numbers for the next scheduled draw. Every ticket is recorded to your wallet forever.',
      stats.perks.slotSpinsLeft || stats.perks.rouletteSpinsLeft
        ? 'Use your daily free spins on the casino floor - they cost nothing and wins credit to your balance.'
        : 'Deposit once and play slots or roulette from your casino balance with no extra gas per spin.',
      window.ProvablyFair?.explainOutcome?.(true, 'lottery') || 'Every draw uses a published commit hash so results can be verified after the numbers are revealed.',
    ];
    el.innerHTML = `
      <h4><span data-icon="heart-handshake" data-icon-size="16"></span> Keep playing smart</h4>
      <ul class="dash-encourage-list">
        ${tips.map((t) => `<li>${t}</li>`).join('')}
      </ul>`;
  }

  function destroyCharts() {
    Object.values(charts).forEach((c) => c?.destroy?.());
    charts = { wins: null, byGame: null };
  }

  function renderCharts(wallet, stats) {
    if (!window.Chart) return;
    destroyCharts();
    const buckets = monthWinBuckets(wallet);

    const winsCanvas = document.getElementById('dashWinsChart');
    if (winsCanvas) {
      charts.wins = new Chart(winsCanvas, {
        type: 'bar',
        data: {
          labels: buckets.labels.length ? buckets.labels : ['No wins yet'],
          datasets: [{
            label: 'Winnings',
            data: buckets.earned.length ? buckets.earned : [0],
            backgroundColor: 'rgba(245, 183, 49, 0.75)',
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => ` ${formatUsd(ctx.parsed.y)}` } },
          },
          scales: {
            x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true },
          },
        },
      });
    }

    const byGameCanvas = document.getElementById('dashByGameChart');
    if (byGameCanvas) {
      const data = [stats.drawWins, stats.slotWins, stats.rouletteWins];
      const hasWins = data.some((n) => n > 0);
      charts.byGame = new Chart(byGameCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Lottery', 'Slots', 'Roulette'],
          datasets: [{
            data: hasWins ? data : [1, 1, 1],
            backgroundColor: ['#a78bfa', '#f5b731', '#4ade80'],
            borderWidth: 0,
          }],
        },
        options: {
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8' } },
            tooltip: { enabled: hasWins },
          },
        },
      });
    }
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
      if (['connected', 'disconnected', 'ticket-purchased', 'withdraw-success', 'deposit-success'].includes(event)) {
        refresh();
      }
    });
    window.addEventListener('slot-played', () => refresh());
    window.addEventListener('roulette-played', () => refresh());
    window.addEventListener('draw-completed', () => refresh());
  }

  return { init, refresh, computeStats, getSlotHistory };
})();

window.PlayerDashboard = PlayerDashboard;
