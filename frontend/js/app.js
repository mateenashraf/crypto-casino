/**
 * NeonDraw frontend — a thin display + wallet-input layer over the C# API.
 * All lottery state (draws, tickets, pool, winners) comes from the backend.
 */
(function () {
  const api = window.NeonDrawApi;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let selectedNumbers = [];
  let selectedDrawId = null;

  // ---- API base config + health ----
  function initApiConfig() {
    const input = $('apiBase');
    input.value = api.getBase();
    input.addEventListener('change', () => {
      api.setBase(input.value.trim());
      refreshAll();
    });
  }

  async function checkHealth() {
    const el = $('apiHealth');
    try {
      await api.health();
      el.className = 'health ok';
      el.title = 'API healthy';
    } catch {
      el.className = 'health bad';
      el.title = 'API unreachable — is the backend running?';
    }
  }

  // ---- Stats ----
  async function renderStats() {
    try {
      const s = await api.getStats();
      $('statsBar').innerHTML = [
        ['Pool (USD)', `$${Number(s.totalPoolUsd).toLocaleString()}`],
        ['Pool (ETH)', Number(s.totalPoolEth).toFixed(4)],
        ['Tickets', s.totalTickets],
        ['Winners', s.totalWinners],
        ['Paid out', `$${Number(s.totalPaidOutUsd).toLocaleString()}`],
        ['Open draws', s.openDraws],
      ].map(([k, v]) => `<div class="stat"><div class="v">${esc(v)}</div><div class="k">${esc(k)}</div></div>`).join('');
    } catch (e) {
      $('statsBar').innerHTML = `<div class="stat"><div class="v">—</div><div class="k">stats unavailable</div></div>`;
    }
  }

  async function renderPoolPolicy() {
    try {
      const p = await api.getPoolPolicy();
      $('poolPolicy').textContent = p.description;
    } catch { /* ignore */ }
  }

  // ---- Draws ----
  async function renderDraws() {
    const el = $('drawList');
    try {
      const draws = await api.getDraws();
      if (!draws.length) { el.textContent = 'No draws.'; return; }
      if (!selectedDrawId) selectedDrawId = draws[0].onChainDrawId;
      el.innerHTML = draws.map((d) => `
        <button class="draw-card ${d.onChainDrawId === selectedDrawId ? 'active' : ''}" data-id="${d.onChainDrawId}">
          <div class="tier">${esc(d.tier)} <span class="badge ${esc(d.status)}">${esc(d.status)}</span></div>
          <div class="meta">Pool ${Number(d.poolBalanceEth).toFixed(4)} ETH · ${d.ticketCount} tickets · ${Number(d.ticketPriceEth).toFixed(4)} ETH/ticket</div>
          <div class="meta">Jackpot $${Number(d.advertisedJackpotUsd).toLocaleString()}</div>
        </button>`).join('');
      el.querySelectorAll('.draw-card').forEach((c) => c.addEventListener('click', () => {
        selectedDrawId = Number(c.dataset.id);
        updateSelectedLabel(draws);
        renderDraws();
      }));
      updateSelectedLabel(draws);
    } catch (e) {
      el.textContent = 'Could not load draws: ' + e.message;
    }
  }

  function updateSelectedLabel(draws) {
    const d = draws.find((x) => x.onChainDrawId === selectedDrawId);
    $('selectedDrawLabel').textContent = d ? `#${d.onChainDrawId} ${d.tier} (${d.status})` : 'none';
  }

  // ---- Number picker ----
  function renderGrid() {
    const grid = $('numberGrid');
    grid.innerHTML = '';
    for (let i = 1; i <= 49; i++) {
      const b = document.createElement('button');
      b.className = 'ball' + (selectedNumbers.includes(i) ? ' sel' : '');
      b.textContent = i;
      b.addEventListener('click', () => toggle(i));
      grid.appendChild(b);
    }
    $('picked').textContent = selectedNumbers.length
      ? selectedNumbers.slice().sort((a, b) => a - b).join(' · ')
      : 'pick 6';
  }
  function toggle(n) {
    if (selectedNumbers.includes(n)) selectedNumbers = selectedNumbers.filter((x) => x !== n);
    else if (selectedNumbers.length < 6) selectedNumbers.push(n);
    renderGrid();
  }
  function quickPick() {
    const pool = Array.from({ length: 49 }, (_, i) => i + 1);
    selectedNumbers = [];
    for (let i = 0; i < 6; i++) selectedNumbers.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    renderGrid();
  }

  // ---- Buy ----
  async function buy() {
    const status = $('buyStatus');
    const wallet = $('wallet').value.trim();
    const quantity = parseInt($('qty').value, 10) || 1;
    if (!selectedDrawId) { status.className = 'status err'; status.textContent = 'Select a draw first.'; return; }
    if (selectedNumbers.length !== 6) { status.className = 'status err'; status.textContent = 'Pick exactly 6 numbers.'; return; }

    status.className = 'status'; status.textContent = 'Submitting…';
    try {
      const r = await api.buyTicket({ drawId: selectedDrawId, walletAddress: wallet, numbers: selectedNumbers, quantity });
      status.className = 'status ok';
      status.textContent = `Bought ${r.ticketsCreated} ticket(s) for $${r.totalUsd} (${r.totalEth} ETH).`;
      selectedNumbers = [];
      renderGrid();
      $('lookupWallet').value = wallet;
      await Promise.all([renderStats(), renderDraws()]);
    } catch (e) {
      status.className = 'status err';
      status.textContent = e.message;
    }
  }

  // ---- Lookup ----
  async function lookup() {
    const el = $('lookupResult');
    const wallet = $('lookupWallet').value.trim();
    el.textContent = 'Searching…';
    try {
      const r = await api.lookupTickets(wallet);
      if (!r.ticketCount) { el.textContent = 'No tickets found for that address.'; return; }
      el.innerHTML = `<p>${r.ticketCount} ticket(s) · $${r.totalUsd} · ${Number(r.totalEth).toFixed(4)} ETH</p>` +
        r.tickets.map((t) => `<div class="item">
          <div class="nums">${t.numbers.join(' · ')}</div>
          <div class="mono">draw #${t.drawId} · ${esc(t.tier)} · $${t.paidAmountUsd}${t.isWinner ? ' · 🏆 winner' : ''}</div>
        </div>`).join('');
    } catch (e) {
      el.textContent = e.message;
    }
  }

  // ---- Winners ----
  async function renderWinners() {
    const el = $('winnersList');
    try {
      const w = await api.getWinners(10);
      if (!w.length) { el.textContent = 'No winners yet — settle a draw.'; return; }
      el.innerHTML = w.map((x) => `<div class="item">
        <div class="nums">${x.winningNumbers.join(' · ')}</div>
        <div class="mono">${esc(x.tier)} · <span class="prize">$${x.prizeUsd}</span> · ${esc(x.walletAddress.slice(0, 10))}…${x.isSimulated ? ' · sim' : ''}</div>
      </div>`).join('');
    } catch (e) {
      el.textContent = e.message;
    }
  }

  async function refreshAll() {
    await checkHealth();
    await Promise.all([renderStats(), renderPoolPolicy(), renderDraws(), renderWinners()]);
  }

  function init() {
    initApiConfig();
    renderGrid();
    $('quickPick').addEventListener('click', quickPick);
    $('clearNums').addEventListener('click', () => { selectedNumbers = []; renderGrid(); });
    $('buyBtn').addEventListener('click', buy);
    $('lookupBtn').addEventListener('click', lookup);
    $('lookupMine').addEventListener('click', () => { $('lookupWallet').value = $('wallet').value.trim(); lookup(); });
    $('refreshWinners').addEventListener('click', renderWinners);
    refreshAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
