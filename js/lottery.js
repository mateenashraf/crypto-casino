/**
 * NeonDraw Crypto Lottery, $20M jackpot, real on-chain ticket purchases
 */
const LotteryApp = (() => {
  const JACKPOT_USD = 20_000_000;
  const ETH_USD_RATE = 3200;
  const BASE_TICKET_USD = 1;
  const MAX_CUSTOM_USD = 6400;

  const TICKET_TIERS = [
    { usd: 1, label: '$1', tag: 'Starter' },
    { usd: 5, label: '$5', tag: null },
    { usd: 10, label: '$10', tag: 'Popular' },
    { usd: 50, label: '$50', tag: null },
    { usd: 100, label: '$100', tag: 'Best Value' },
    { usd: 300, label: '$300', tag: null },
    { usd: 500, label: '$500', tag: 'VIP' },
  ];

  const OFFERS = [
    {
      id: 'lucky-dip',
      badge: 'STARTER',
      badgeClass: 'starter',
      title: '$1 Lucky Dip',
      desc: 'One dollar. One dream. Jump in with the lowest entry on the board.',
      usd: 1,
      qty: 1,
      cta: 'Try $1',
    },
    {
      id: 'bundle-5',
      badge: 'SAVE 20%',
      badgeClass: 'save',
      title: '5 Tickets for $4',
      desc: 'Grab 5 entries for the price of 4, same numbers, 5× the odds.',
      usd: 4,
      qty: 5,
      unitUsd: 0.8,
      cta: 'Claim Offer',
    },
    {
      id: 'power-100',
      badge: 'BONUS',
      badgeClass: 'bonus',
      title: '$100 Power Pack',
      desc: '$100 ticket plus 10 free $1 bonus entries, 11 shots at the jackpot.',
      usd: 100,
      qty: 11,
      unitUsd: 100 / 11,
      cta: 'Get Power Pack',
    },
    {
      id: 'high-roller',
      badge: 'VIP',
      badgeClass: 'vip',
      title: '$500 High Roller',
      desc: 'Premium entry with VIP draw weighting and priority winner pool access.',
      usd: 500,
      qty: 1,
      cta: 'Go VIP',
    },
    {
      id: 'bulk-50',
      badge: '10% OFF',
      badgeClass: 'save',
      title: '50+ Bulk Saver',
      desc: '50 tickets for $45, automatic 10% bulk discount. Same numbers, massive odds boost.',
      usd: 45,
      qty: 50,
      unitUsd: 0.9,
      cta: 'Build Bundle',
    },
    {
      id: 'flash-friday',
      badge: '2× ENTRIES',
      badgeClass: 'hot',
      title: 'Flash Friday Double',
      desc: 'Every $50 ticket this Friday includes a matching bonus entry, free.',
      usd: 50,
      qty: 2,
      unitUsd: 25,
      cta: 'Double Up',
    },
  ];

  const wallet = () => window.SecureWeb3;
  let selectedNumbers = [];
  let selection = {
    mode: 'tier',
    usd: 10,
    label: '$10',
    quantity: 1,
    totalUsd: 10,
    unitUsd: 10,
    offerId: null,
  };
  let customAmountUsd = 25;
  let walletAfford = { eth: 0, usd: 0, tickets: 0 };

  function usdToEth(usd) {
    return parseFloat((usd / ETH_USD_RATE).toFixed(6));
  }

  function formatUsd(n) {
    return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  function getPurchaseSummary() {
    if (selection.mode === 'custom') {
      const amount = Math.min(Math.max(1, Math.floor(customAmountUsd)), MAX_CUSTOM_USD);
      const affordable = walletAfford.tickets > 0 ? Math.min(amount, walletAfford.tickets) : amount;
      const qty = Math.max(1, affordable);
      return {
        mode: 'custom',
        label: 'Custom',
        quantity: qty,
        unitUsd: BASE_TICKET_USD,
        totalUsd: qty * BASE_TICKET_USD,
        totalEth: usdToEth(qty * BASE_TICKET_USD),
      };
    }

    return {
      mode: selection.mode,
      label: selection.label,
      quantity: selection.quantity,
      unitUsd: selection.unitUsd,
      totalUsd: selection.totalUsd,
      totalEth: usdToEth(selection.totalUsd),
      offerId: selection.offerId,
    };
  }

  function setTier(tier) {
    selection = {
      mode: 'tier',
      usd: tier.usd,
      label: tier.label,
      quantity: 1,
      totalUsd: tier.usd,
      unitUsd: tier.usd,
      offerId: null,
    };
    customAmountUsd = tier.usd;
    renderTiers();
    updatePurchaseUI();
  }

  function setCustomMode() {
    selection = {
      mode: 'custom',
      usd: customAmountUsd,
      label: 'Custom',
      quantity: 1,
      totalUsd: customAmountUsd,
      unitUsd: BASE_TICKET_USD,
      offerId: null,
    };
    renderTiers();
    updatePurchaseUI();
  }

  function applyOffer(offer) {
    if (offer.customUsd) {
      customAmountUsd = offer.customUsd;
      setCustomMode();
      selection.offerId = offer.id;
    } else {
      selection = {
        mode: 'offer',
        usd: offer.usd,
        label: offer.title,
        quantity: offer.qty,
        totalUsd: offer.usd,
        unitUsd: offer.unitUsd || offer.usd / offer.qty,
        offerId: offer.id,
      };
      customAmountUsd = offer.usd;
    }
    renderTiers();
    updatePurchaseUI();
    window.AppUI?.scrollToSection?.('#lottery');
    window.AppUI?.toast(`${offer.title} applied`, 'success');
  }

  async function refreshAffordability() {
    if (!wallet().isConnected()) {
      walletAfford = { eth: 0, usd: 0, tickets: 0 };
      return;
    }
    try {
      const eth = await wallet().getWalletBalance();
      const cfg = wallet().getConfig();
      const maxEth = Math.min(eth * 0.95, cfg.MAX_ETH);
      const maxUsd = maxEth * ETH_USD_RATE;
      walletAfford = {
        eth: maxEth,
        usd: maxUsd,
        tickets: Math.floor(maxUsd / BASE_TICKET_USD),
      };
    } catch {
      walletAfford = { eth: 0, usd: 0, tickets: 0 };
    }
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

    const tierHtml = TICKET_TIERS.map((t) => {
      const active = selection.mode === 'tier' && selection.usd === t.usd;
      const tag = t.tag ? `<span class="tier-tag">${t.tag}</span>` : '';
      return `
        <button type="button" class="ticket-tier ${active ? 'active' : ''}" data-usd="${t.usd}">
          ${tag}
          <strong>${t.label}</strong>
          <small>${usdToEth(t.usd)} ETH</small>
        </button>`;
    }).join('');

    const customActive = selection.mode === 'custom';
    el.innerHTML = tierHtml + `
      <button type="button" class="ticket-tier ticket-tier-custom ${customActive ? 'active' : ''}" id="customTierBtn">
        <span class="tier-tag">Flex</span>
        <strong>Custom</strong>
        <small>Any amount</small>
      </button>`;

    el.querySelectorAll('.ticket-tier[data-usd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tier = TICKET_TIERS.find((t) => t.usd === parseInt(btn.dataset.usd, 10));
        if (tier) setTier(tier);
      });
    });

    document.getElementById('customTierBtn')?.addEventListener('click', setCustomMode);

    const panel = document.getElementById('customTierPanel');
    if (panel) panel.hidden = selection.mode !== 'custom';
  }

  function updatePurchaseUI() {
    const summary = getPurchaseSummary();
    const panel = document.getElementById('customTierPanel');
    const summaryEl = document.getElementById('purchaseSummary');
    const buyBtn = document.getElementById('buyTicketBtn');
    const offerBanner = document.getElementById('activeOfferBanner');

    if (panel) {
      panel.hidden = selection.mode !== 'custom';
    }

    if (selection.mode === 'custom') {
      const input = document.getElementById('customAmount');
      if (input && document.activeElement !== input) {
        input.value = String(Math.floor(customAmountUsd));
      }
    }

    if (summaryEl) {
      const { quantity, totalUsd, totalEth } = summary;
      const requested = Math.max(1, Math.floor(customAmountUsd));
      const capped = wallet().isConnected() && walletAfford.tickets > 0 && requested > walletAfford.tickets;

      if (selection.mode === 'custom') {
        summaryEl.innerHTML = `
          <div class="custom-summary-row">
            <span class="custom-summary-count">${quantity.toLocaleString()}</span>
            <span class="custom-summary-label">ticket${quantity === 1 ? '' : 's'} @ ${formatUsd(BASE_TICKET_USD)} each</span>
          </div>
          <div class="custom-summary-total">Total <strong>${formatUsd(totalUsd)}</strong> · ${totalEth} ETH</div>
          ${capped ? `<p class="custom-summary-warn">Wallet covers ${walletAfford.tickets.toLocaleString()} tickets (${formatUsd(walletAfford.usd)})</p>` : ''}
          ${wallet().isConnected() && walletAfford.tickets > 0
            ? `<p class="custom-summary-afford">You can afford up to <strong>${walletAfford.tickets.toLocaleString()}</strong> tickets</p>`
            : '<p class="custom-summary-afford muted">Connect wallet to see max tickets</p>'}`;
      } else {
        summaryEl.innerHTML = `
          <div class="custom-summary-total">${summary.label} · <strong>${formatUsd(totalUsd)}</strong> · ${totalEth} ETH</div>
          ${summary.quantity > 1 ? `<p class="custom-summary-afford">${summary.quantity} entries · ${formatUsd(summary.unitUsd)} effective per ticket</p>` : ''}`;
      }
    }

    if (buyBtn) {
      buyBtn.textContent = summary.quantity > 1
        ? `Buy ${summary.quantity.toLocaleString()} Tickets · ${formatUsd(summary.totalUsd)}`
        : `Buy ${summary.label} Ticket · ${formatUsd(summary.totalUsd)}`;
    }

    if (offerBanner) {
      if (selection.offerId) {
        const offer = OFFERS.find((o) => o.id === selection.offerId);
        offerBanner.hidden = false;
        offerBanner.innerHTML = `<span class="offer-banner-icon" data-icon="gift" data-icon-size="16"></span> Active offer: <strong>${offer?.title || 'Promo'}</strong>`;
        window.Icons?.hydrate(offerBanner);
      } else {
        offerBanner.hidden = true;
      }
    }
  }

  function renderOffers() {
    const grid = document.getElementById('promoGrid');
    if (!grid) return;

    grid.innerHTML = OFFERS.map((o) => `
      <article class="promo-card promo-card-${o.badgeClass || 'default'}" data-offer-id="${o.id}">
        <div class="promo-badge promo-badge-${o.badgeClass || 'default'}">${o.badge}</div>
        <h3>${o.title}</h3>
        <p>${o.desc}</p>
        <div class="promo-meta">
          ${o.qty > 1 ? `<span>${o.qty} entries</span>` : ''}
          <span class="promo-price">${formatUsd(o.usd || o.customUsd || 0)}</span>
        </div>
        <button type="button" class="btn ${o.badgeClass === 'vip' ? 'btn-gold' : 'btn-outline'} promo-cta" data-offer-id="${o.id}">${o.cta}</button>
      </article>
    `).join('');

    grid.querySelectorAll('.promo-cta').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const offer = OFFERS.find((x) => x.id === btn.dataset.offerId);
        if (offer) applyOffer(offer);
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
    if (poolAmt) {
      const retain = window.PoolPolicy?.getRetentionSummary?.(contributions);
      poolAmt.textContent = retain
        ? `${formatUsd(contributions)} in play · ${retain.retainPct}% retained`
        : `${formatUsd(contributions)} in play`;
    }
    if (statTickets) statTickets.textContent = getDisplayTicketCount().toLocaleString();
  }

  function groupTicketsForDisplay(tickets) {
    const groups = new Map();
    tickets.forEach((t) => {
      const key = t.bundleTotal ? t.hash : t.id;
      if (!groups.has(key)) {
        groups.set(key, {
          wallet: wallet().shortenAddress(t.wallet),
          numbers: t.numbers,
          usdPrice: t.usdPrice,
          totalUsd: t.usdPrice,
          count: 1,
          simulated: false,
          timestamp: t.timestamp,
        });
      } else {
        const g = groups.get(key);
        g.count += 1;
        g.totalUsd += t.usdPrice;
        g.timestamp = Math.max(g.timestamp, t.timestamp);
      }
    });
    return [...groups.values()].map((g) => ({
      ...g,
      usdPrice: g.count > 1 ? g.totalUsd : g.usdPrice,
      label: g.count > 1 ? `${g.count}× entries` : null,
    }));
  }

  function renderActivityFeed() {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;

    const real = groupTicketsForDisplay(wallet().getAllTickets());
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

    feed.innerHTML = merged.map((t) => {
      if (t.type === 'win') {
        const prizeClass = t.prizeType === 'free_ticket' ? ' amount-ticket' : ' amount-win';
        const when = new Date(t.timestamp).toLocaleString(undefined, {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        });
        return `
      <div class="activity-item activity-item-win ${t.simulated ? 'simulated' : 'verified'}">
        <span class="wallet">${t.wallet}</span>
        <span class="activity-win-detail">Won ${t.prizeLabel}${t.jackpotTierWin ? ' (top tier)' : ''} · ${t.drawName}</span>
        <span class="amount${prizeClass}">${when}</span>
      </div>`;
      }
      return `
      <div class="activity-item ${t.simulated ? 'simulated' : 'verified'}">
        <span class="wallet">${t.wallet}</span>
        <span>${t.label || t.numbers.join(', ')}</span>
        <span class="amount">${formatUsd(t.usdPrice)}</span>
      </div>`;
    }).join('');
  }

  function onSimulatedActivity() {
    updateJackpot();
    renderActivityFeed();
  }

  async function redeemFreeTicket() {
    const btn = document.getElementById('redeemFreeTicketBtn');
    const status = document.getElementById('ticketStatus');

    if (!wallet().isConnected()) {
      window.AppUI?.openWallet();
      window.AppUI?.toast('Connect wallet to redeem free tickets', 'info');
      return;
    }

    if (selectedNumbers.length !== 6) {
      window.AppUI?.toast('Select 6 numbers first', 'error');
      return;
    }

    if (wallet().getFreeTicketBalance(wallet().getAddress()) < 1) {
      window.AppUI?.toast('No free tickets available', 'info');
      updateFreeTicketUI();
      return;
    }

    btn.disabled = true;
    if (status) {
      status.hidden = false;
      status.className = 'tx-status pending';
      status.textContent = 'Redeeming free ticket...';
    }

    try {
      const drawId = window.DrawEngine?.getSelectedDrawId?.();
      const ticket = wallet().redeemFreeTicket(selectedNumbers, drawId);

      if (window.DrawEngine && drawId) {
        window.DrawEngine.registerTicket(drawId, ticket);
      }

      const msg = 'Free ticket redeemed. Good luck in the draw!';
      if (status) { status.className = 'tx-status success'; status.textContent = msg; }
      window.AppUI?.toast(msg, 'success');
      selectedNumbers = [];
      renderNumberGrid();
      updateJackpot();
      renderActivityFeed();
      updateFreeTicketUI();
      updatePurchaseUI();
      window.ActivitySimulator?.renderTicker?.(ticket.id);
    } catch (err) {
      const msg = err.message || 'Redemption failed';
      if (status) { status.className = 'tx-status error'; status.textContent = msg; }
      window.AppUI?.toast(msg, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function updateFreeTicketUI() {
    const banner = document.getElementById('freeTicketBanner');
    const countEl = document.getElementById('freeTicketCount');
    if (!banner) return;

    const n = wallet().isConnected()
      ? wallet().getFreeTicketBalance(wallet().getAddress())
      : 0;
    banner.hidden = n < 1;
    if (countEl) countEl.textContent = String(n);
  }

  async function buyTicket() {
    const btn = document.getElementById('buyTicketBtn');
    const status = document.getElementById('ticketStatus');
    const summary = getPurchaseSummary();

    if (!wallet().isConnected()) {
      window.AppUI?.openWallet();
      window.AppUI?.toast('Connect wallet to buy tickets', 'info');
      return;
    }

    if (selectedNumbers.length !== 6) {
      window.AppUI?.toast('Select 6 numbers first', 'error');
      return;
    }

    await refreshAffordability();
    if (summary.totalEth > walletAfford.eth && walletAfford.eth > 0) {
      window.AppUI?.toast(`Insufficient balance. Max ${walletAfford.tickets} tickets`, 'error');
      return;
    }

    btn.disabled = true;
    if (status) {
      status.hidden = false;
      status.className = 'tx-status pending';
      status.textContent = summary.quantity > 1
        ? `Confirm ${summary.quantity} tickets in your wallet...`
        : 'Confirm in your wallet...';
    }

    try {
      const tickets = await wallet().buyLotteryTicketBulk(
        summary.totalEth,
        selectedNumbers,
        summary.totalUsd,
        summary.quantity,
        summary.unitUsd
      );
      const last = tickets[tickets.length - 1];

      if (window.DrawEngine) {
        tickets.forEach((t) => window.DrawEngine.registerTicket(window.DrawEngine.getSelectedDrawId(), t));
      }

      const msg = summary.quantity > 1
        ? `${summary.quantity} tickets purchased for ${formatUsd(summary.totalUsd)}!`
        : `Ticket purchased for ${summary.label}!`;

      if (status) { status.className = 'tx-status success'; status.textContent = msg; }
      window.AppUI?.toast(msg, 'success');
      selectedNumbers = [];
      renderNumberGrid();
      updateJackpot();
      renderActivityFeed();
      await refreshAffordability();
      updatePurchaseUI();
      window.ActivitySimulator?.renderTicker?.(last.id);
    } catch (err) {
      const msg = err.reason || err.message || 'Purchase failed';
      if (status) { status.className = 'tx-status error'; status.textContent = msg; }
      window.AppUI?.toast(msg, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function init() {
    selection = { mode: 'tier', usd: 10, label: '$10', quantity: 1, totalUsd: 10, unitUsd: 10, offerId: null };
    customAmountUsd = 25;

    renderNumberGrid();
    renderTiers();
    renderOffers();
    updatePurchaseUI();
    updateFreeTicketUI();
    updateJackpot();
    renderActivityFeed();
    refreshAffordability().then(updatePurchaseUI);

    document.getElementById('quickPickBtn')?.addEventListener('click', quickPick);
    document.getElementById('clearNumbersBtn')?.addEventListener('click', () => {
      selectedNumbers = [];
      renderNumberGrid();
    });
    document.getElementById('buyTicketBtn')?.addEventListener('click', buyTicket);
    document.getElementById('redeemFreeTicketBtn')?.addEventListener('click', redeemFreeTicket);

    document.getElementById('customAmount')?.addEventListener('input', (e) => {
      customAmountUsd = Math.max(1, parseInt(e.target.value, 10) || 1);
      if (selection.mode !== 'custom') setCustomMode();
      else updatePurchaseUI();
    });

    wallet().on(async (event, data) => {
      if (event === 'connected') {
        await refreshAffordability();
        updatePurchaseUI();
        updateFreeTicketUI();
      }
      if (event === 'ticket-purchased' || event === 'pool-updated') {
        updateJackpot();
        renderActivityFeed();
      }
      if (event === 'free-ticket-granted' || event === 'free-ticket-redeemed') {
        updateFreeTicketUI();
        if (event === 'free-ticket-granted' && data?.address?.toLowerCase() === wallet().getAddress()?.toLowerCase()) {
          window.AppUI?.toast(`You won ${data.qty} free ticket${data.qty > 1 ? 's' : ''}! Redeem below.`, 'success');
        }
      }
      if (event === 'disconnected') {
        walletAfford = { eth: 0, usd: 0, tickets: 0 };
        updatePurchaseUI();
        updateFreeTicketUI();
      }
    });

    if (window.DrawEngine) {
      window.DrawEngine.init();
    }

    if (window.ActivitySimulator?.isEnabled()) {
      window.ActivitySimulator.init();
    }
  }

  return {
    init, JACKPOT_USD, formatUsd, onSimulatedActivity, updateJackpot,
    renderActivityFeed, applyOffer, OFFERS, getPurchaseSummary, updateFreeTicketUI,
  };
})();

window.LotteryApp = LotteryApp;
