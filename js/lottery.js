/**
 * StarBitz Crypto Lottery — $20M jackpot, real on-chain ticket purchases
 */
const LotteryApp = (() => {
  const JACKPOT_USD = 20_000_000;
  const ETH_USD_RATE = 3200; // demo rate for display
  const TICKET_TIERS = [
    { usd: 5, label: '$5' },
    { usd: 20, label: '$20' },
    { usd: 50, label: '$50' },
    { usd: 100, label: '$100' },
    { usd: 300, label: '$300' },
    { usd: 500, label: '$500' },
  ];

  const wallet = () => window.SecureWeb3;
  let selectedNumbers = [];
  let selectedTier = TICKET_TIERS[1];

  function usdToEth(usd) {
    return parseFloat((usd / ETH_USD_RATE).toFixed(6));
  }

  function formatUsd(n) {
    return '$' + Math.round(n).toLocaleString();
  }

  function renderNumberGrid() {
    const grid = document.getElementById('numberGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 1; i <= 49; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'number-ball' + (selectedNumbers.includes(i) ? ' selected' : '');
      btn.textContent = i;
      btn.addEventListener('click', () => toggleNumber(i));
      grid.appendChild(btn);
    }
    renderSelectedPills();
  }

  function toggleNumber(n) {
    if (selectedNumbers.includes(n)) {
      selectedNumbers = selectedNumbers.filter((x) => x !== n);
    } else if (selectedNumbers.length < 6) {
      selectedNumbers.push(n);
    }
    renderNumberGrid();
  }

  function renderSelectedPills() {
    const el = document.getElementById('selectedPills');
    if (!el) return;
    el.innerHTML = selectedNumbers.length
      ? selectedNumbers.sort((a, b) => a - b).map((n) => `<span class="selected-pill">${n}</span>`).join('')
      : '<span style="color:var(--text-muted);font-size:0.85rem">Pick 6 numbers (1–49)</span>';
  }

  function quickPick() {
    const pool = Array.from({ length: 49 }, (_, i) => i + 1);
    selectedNumbers = [];
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      selectedNumbers.push(pool.splice(idx, 1)[0]);
    }
    renderNumberGrid();
  }

  function renderTiers() {
    const el = document.getElementById('ticketTiers');
    if (!el) return;
    el.innerHTML = TICKET_TIERS.map((t) => `
      <button type="button" class="ticket-tier ${t.usd === selectedTier.usd ? 'active' : ''}" data-usd="${t.usd}">
        <strong>${t.label}</strong>
        <small>${usdToEth(t.usd)} ETH</small>
      </button>
    `).join('');

    el.querySelectorAll('.ticket-tier').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedTier = TICKET_TIERS.find((t) => t.usd === parseInt(btn.dataset.usd, 10));
        renderTiers();
      });
    });
  }

  function getDisplayPool() {
    let total = wallet().getPoolContributions();
    if (window.ActivitySimulator?.isEnabled()) {
      total += window.ActivitySimulator.getSimulatedPool();
    }
    return total;
  }

  function getDisplayTicketCount() {
    let count = wallet().getAllTickets().length;
    if (window.ActivitySimulator?.isEnabled()) {
      count += window.ActivitySimulator.getSimulatedTicketCount();
    }
    return count;
  }

  function updateJackpot() {
    const contributions = getDisplayPool();
    const featured = window.DrawEngine?.getSelectedDraw();
    const jackpotTarget = featured
      ? (featured.getPrize ? featured.getPrize(new Date()) : featured.prize)
      : JACKPOT_USD;
    const poolPct = Math.min((contributions / jackpotTarget) * 100, 99.9);
    const fill = document.getElementById('poolBarFill');
    const poolAmt = document.getElementById('poolAmount');
    const statTickets = document.getElementById('statTickets');

    if (fill) fill.style.width = `${Math.max(poolPct, 8)}%`;
    if (poolAmt) poolAmt.textContent = `${formatUsd(contributions)} in play`;
    if (statTickets) statTickets.textContent = getDisplayTicketCount().toLocaleString();
  }

  function renderActivityFeed() {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;

    const real = wallet().getAllTickets().map((t) => ({
      wallet: wallet().shortenAddress(t.wallet),
      numbers: t.numbers,
      usdPrice: t.usdPrice,
      simulated: false,
      timestamp: t.timestamp,
    }));

    const simulated = window.ActivitySimulator?.isEnabled()
      ? window.ActivitySimulator.getFeedItems()
      : [];

    const merged = [...real, ...simulated]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 30);

    if (!merged.length) {
      feed.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:20px 0;text-align:center">Waiting for ticket activity...</p>';
      return;
    }

    feed.innerHTML = merged.map((t) => `
      <div class="activity-item ${t.simulated ? 'simulated' : 'verified'}">
        <span class="wallet">${t.wallet}</span>
        <span>${t.numbers.join(', ')}</span>
        <span class="amount">${formatUsd(t.usdPrice)}</span>
      </div>
    `).join('');
  }

  function onSimulatedActivity() {
    updateJackpot();
    renderActivityFeed();
  }

  async function buyTicket() {
    const btn = document.getElementById('buyTicketBtn');
    const status = document.getElementById('ticketStatus');

    if (!wallet().isConnected()) {
      window.AppUI?.openWallet();
      window.AppUI?.toast('Connect wallet to buy tickets', 'info');
      return;
    }

    if (selectedNumbers.length !== 6) {
      window.AppUI?.toast('Select 6 numbers first', 'error');
      return;
    }

    const eth = usdToEth(selectedTier.usd);
    btn.disabled = true;
    if (status) { status.hidden = false; status.className = 'tx-status pending'; status.textContent = 'Confirm in your wallet...'; }

    try {
      const ticket = await wallet().buyLotteryTicket(eth, selectedNumbers, selectedTier.usd);
      if (window.DrawEngine) {
        window.DrawEngine.registerTicket(window.DrawEngine.getSelectedDrawId(), ticket);
      }
      if (status) { status.className = 'tx-status success'; status.textContent = `Ticket purchased for ${selectedTier.label}!`; }
      window.AppUI?.toast(`Ticket confirmed — ${selectedTier.label}`, 'success');
      selectedNumbers = [];
      renderNumberGrid();
      updateJackpot();
      renderActivityFeed();
    } catch (err) {
      const msg = err.reason || err.message || 'Purchase failed';
      if (status) { status.className = 'tx-status error'; status.textContent = msg; }
      window.AppUI?.toast(msg, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function init() {
    renderNumberGrid();
    renderTiers();
    updateJackpot();
    renderActivityFeed();

    document.getElementById('quickPickBtn')?.addEventListener('click', quickPick);
    document.getElementById('clearNumbersBtn')?.addEventListener('click', () => {
      selectedNumbers = [];
      renderNumberGrid();
    });
    document.getElementById('buyTicketBtn')?.addEventListener('click', buyTicket);

    wallet().on((event) => {
      if (event === 'ticket-purchased' || event === 'pool-updated') {
        updateJackpot();
        renderActivityFeed();
      }
    });

    if (window.DrawEngine) {
      window.DrawEngine.init();
    }

    if (window.ActivitySimulator?.isEnabled()) {
      window.ActivitySimulator.init();
    }
  }

  return { init, JACKPOT_USD, formatUsd, onSimulatedActivity, updateJackpot, renderActivityFeed };
})();

window.LotteryApp = LotteryApp;
