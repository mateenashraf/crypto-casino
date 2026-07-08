/**
 * NeonDraw Crypto Lottery, $20M jackpot, real on-chain ticket purchases
 */
const LotteryApp = (() => {
  const JACKPOT_USD = 20_000_000;
  const MAX_CUSTOM_USD = 10_000;
  const TP = () => window.TicketPricing;

  const TICKET_TIERS = [
    { usd: 10, tag: null },
    { usd: 20, tag: null },
    { usd: 50, tag: 'Popular' },
    { usd: 100, tag: null },
    { usd: 300, tag: null },
    { usd: 500, tag: 'Best Value' },
    { usd: 1000, tag: 'VIP' },
  ];

  const OFFERS = [
    {
      id: 'starter-10',
      badge: 'STARTER',
      badgeClass: 'starter',
      title: '$10 Quick Entry',
      desc: 'Lowest ticket on the board — full $10 goes straight to the prize pool.',
      poolUsd: 10,
      qty: 1,
      cta: 'Try $10',
    },
    {
      id: 'bundle-50',
      badge: 'SAVE 10%',
      badgeClass: 'save',
      title: '$50 Value Pack',
      desc: '$50 pool entry with a bonus second line — two chances, same numbers.',
      poolUsd: 50,
      qty: 2,
      cta: 'Claim Offer',
    },
    {
      id: 'power-100',
      badge: 'BONUS',
      badgeClass: 'bonus',
      title: '$100 Power Pack',
      desc: '$100 to the pool plus a bonus entry — two shots at the jackpot.',
      poolUsd: 100,
      qty: 2,
      cta: 'Get Power Pack',
    },
    {
      id: 'high-roller',
      badge: 'VIP',
      badgeClass: 'vip',
      title: '$500 High Roller',
      desc: 'Premium $500 pool entry with VIP draw weighting and priority winner pool access.',
      poolUsd: 500,
      qty: 1,
      cta: 'Go VIP',
    },
    {
      id: 'bulk-300',
      badge: '10% OFF',
      badgeClass: 'save',
      title: '$300 Bulk Saver',
      desc: '$300 pool credit with a bonus entry — maximum pool, extra odds.',
      poolUsd: 300,
      qty: 2,
      cta: 'Build Bundle',
    },
    {
      id: 'flash-friday',
      badge: '2× ENTRIES',
      badgeClass: 'hot',
      title: 'Flash Friday Double',
      desc: '$100 ticket this Friday includes a matching bonus entry — two chances to win.',
      poolUsd: 100,
      qty: 2,
      cta: 'Double Up',
    },
  ];

  const wallet = () => window.SecureWeb3;
  let selectedNumbers = [];
  let selection = { mode: 'tier', usd: 50, label: '$50', quantity: 1, offerId: null, offer: null };
  let customAmountUsd = 100;
  let walletAfford = { eth: 0, usd: 0, maxTicketUsd: 0 };
  let liveNetworkFee = null;

  function formatUsd(n) {
    return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  function tierLabel(usd) {
    return TP().formatUsd(usd);
  }

  function quoteOffer(offer) {
    const tp = TP();
    const qty = Math.max(1, Math.floor(offer.qty || 1));
    const poolUsd = offer.poolUsd != null ? offer.poolUsd : tp.MIN_TICKET_USD;
    const base = tp.quote(poolUsd, qty);
    return { ...base, offerId: offer.id };
  }

  function enrichSummary(base, mode, label, offerId) {
    return {
      mode,
      label,
      quantity: base.quantity,
      poolUsd: base.poolUsd,
      gasUsd: base.gasUsd,
      checkoutUsd: base.checkoutUsd,
      checkoutEth: base.checkoutEth,
      unitPoolUsd: base.unitPoolUsd,
      minCheckoutUsd: base.minCheckoutUsd,
      offerId: offerId || null,
      totalUsd: base.checkoutUsd,
      totalEth: base.checkoutEth,
      unitUsd: base.unitPoolUsd,
    };
  }

  function getPurchaseSummary() {
    const tp = TP();

    if (selection.mode === 'offer' && selection.offer) {
      return enrichSummary(quoteOffer(selection.offer), 'offer', selection.label, selection.offerId);
    }

    if (selection.mode === 'custom') {
      const requested = Math.min(Math.max(tp.MIN_TICKET_USD, Math.floor(customAmountUsd)), MAX_CUSTOM_USD);
      const affordable = walletAfford.maxTicketUsd > 0
        ? Math.min(requested, walletAfford.maxTicketUsd)
        : requested;
      const poolUsd = Math.max(tp.MIN_TICKET_USD, affordable);
      return enrichSummary(tp.quote(poolUsd, 1), 'custom', 'Custom', null);
    }

    const poolUsd = selection.usd || tp.MIN_TICKET_USD;
    return enrichSummary(tp.quote(poolUsd, 1), selection.mode, selection.label || tierLabel(poolUsd), selection.offerId);
  }

  function setTier(tier) {
    selection = {
      mode: 'tier',
      usd: tier.usd,
      label: tierLabel(tier.usd),
      quantity: 1,
      offerId: null,
      offer: null,
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
      offerId: null,
      offer: null,
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
        usd: offer.poolUsd,
        label: offer.title,
        quantity: offer.qty || 1,
        offerId: offer.id,
        offer,
      };
      customAmountUsd = offer.poolUsd;
    }
    renderTiers();
    updatePurchaseUI();
    window.AppUI?.scrollToSection?.('#lottery');
    window.AppUI?.toast(`${offer.title} applied`, 'success');
  }

  async function refreshAffordability() {
    if (!wallet().isConnected()) {
      walletAfford = { eth: 0, usd: 0, maxTicketUsd: 0 };
      return;
    }
    try {
      const eth = await wallet().getWalletBalance();
      const cfg = wallet().getConfig();
      const maxEth = Math.min(eth * 0.95, cfg.MAX_ETH);
      const maxUsd = maxEth * TP().getEthUsd();
      walletAfford = {
        eth: maxEth,
        usd: maxUsd,
        maxTicketUsd: TP().maxCheckoutForWalletUsd(maxUsd),
      };
    } catch {
      walletAfford = { eth: 0, usd: 0, maxTicketUsd: 0 };
    }
  }

  function renderCheckoutSummary(summary) {
    const chainId = wallet().getChainId?.() || 11155111;
    const base = window.NetworkFee?.renderCheckoutBlock?.({
      poolUsd: summary.poolUsd,
      checkoutEth: summary.checkoutEth,
      estimate: liveNetworkFee,
      chainId,
    }) || '';
    if (summary.quantity <= 1) return base;
    return base.replace(
      '<p class="fee-line-note">',
      `<div class="fee-line fee-line-muted"><span>Bonus entries</span><span>${summary.quantity} lines</span></div><p class="fee-line-note">`
    );
  }

  async function refreshNetworkFeeEstimate() {
    if (!wallet().isConnected?.()) {
      liveNetworkFee = null;
      return;
    }
    const summary = getPurchaseSummary();
    try {
      liveNetworkFee = await wallet().estimatePlayerNetworkFee?.(summary.checkoutEth) || null;
    } catch {
      liveNetworkFee = null;
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

    const tp = TP();

    const tierHtml = TICKET_TIERS.map((t) => {
      const active = selection.mode === 'tier' && selection.usd === t.usd;
      const tag = t.tag ? `<span class="tier-tag">${t.tag}</span>` : '';
      const quote = tp.quote(t.usd, 1);
      return `
        <button type="button" class="ticket-tier ${active ? 'active' : ''}" data-usd="${t.usd}">
          ${tag}
          <strong>${tierLabel(t.usd)}</strong>
          <small>${quote.checkoutEth} ETH</small>
        </button>`;
    }).join('');

    const customActive = selection.mode === 'custom';
    el.innerHTML = tierHtml + `
      <button type="button" class="ticket-tier ticket-tier-custom ${customActive ? 'active' : ''}" id="customTierBtn">
        <span class="tier-tag">Flex</span>
        <strong>Custom</strong>
        <small>From ${tp.formatUsd(tp.MIN_TICKET_USD)}</small>
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
      const requested = Math.max(TP().MIN_TICKET_USD, Math.floor(customAmountUsd));
      const capped = wallet().isConnected()
        && walletAfford.maxTicketUsd > 0
        && requested > walletAfford.maxTicketUsd;
      const checkout = renderCheckoutSummary(summary);

      if (selection.mode === 'custom') {
        summaryEl.innerHTML = `
          <div class="custom-summary-total">Custom ticket · <strong>${TP().formatUsd(summary.poolUsd)}</strong></div>
          ${checkout}
          ${capped ? `<p class="custom-summary-warn">Wallet covers up to ${TP().formatUsd(walletAfford.maxTicketUsd)} (${TP().formatUsd(walletAfford.usd)} balance)</p>` : ''}
          ${wallet().isConnected() && walletAfford.maxTicketUsd >= TP().MIN_TICKET_USD
            ? `<p class="custom-summary-afford">You can afford up to <strong>${TP().formatUsd(walletAfford.maxTicketUsd)}</strong></p>`
            : '<p class="custom-summary-afford muted">Connect wallet to see max ticket</p>'}`;
      } else {
        summaryEl.innerHTML = `
          <div class="custom-summary-total">${summary.label} ticket</div>
          ${checkout}
          ${summary.quantity > 1
            ? `<p class="custom-summary-afford">${summary.quantity} entries · ${TP().formatUsd(summary.unitPoolUsd)} pool per line</p>`
            : ''}`;
      }
    }

    if (buyBtn) {
      buyBtn.textContent = summary.quantity > 1
        ? `Buy ${summary.quantity} Entries · ${TP().formatUsd(summary.checkoutUsd)}`
        : `Buy ${summary.label} Ticket · ${TP().formatUsd(summary.checkoutUsd)}`;
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

    refreshNetworkFeeEstimate().then(() => {
      const summaryEl2 = document.getElementById('purchaseSummary');
      if (!summaryEl2 || !summaryEl2.querySelector('.checkout-fee-breakdown')) return;
      const summary = getPurchaseSummary();
      const fees = renderCheckoutSummary(summary);
      const box = summaryEl2.querySelector('.checkout-fee-breakdown');
      if (box) box.outerHTML = fees;
    });
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
          ${o.qty > 1 ? `<span>${o.qty} entries</span>` : '<span>1 entry</span>'}
          <span class="promo-price">${TP().formatUsd(quoteOffer(o).checkoutUsd)}</span>
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
    return window.PlatformStats?.getDisplayPoolUsd?.()
      ?? window.ActivitySimulator?.getSimulatedPool?.()
      ?? 1_284_750;
  }

  function getDisplayTicketCount() {
    const metrics = window.PlatformStats?.getLiveMetrics?.();
    if (metrics) return metrics.totalTickets;
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

    if (window.PlatformStats?.renderPlatformMetrics) {
      window.PlatformStats.renderPlatformMetrics();
    } else {
      if (poolAmt) poolAmt.textContent = `${formatUsd(contributions)} in play`;
      if (statTickets) statTickets.textContent = getDisplayTicketCount().toLocaleString();
    }
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
          free: !!t.free,
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
        <span class="amount">${t.free ? 'FREE' : formatUsd(t.usdPrice)}</span>
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
      quickPick();
      window.AppUI?.toast('Quick Pick applied — redeeming your free entry…', 'info');
    }

    if (wallet().getFreeTicketBalance(wallet().getAddress()) < 1) {
      window.AppUI?.toast('No free tickets in wallet — claim one in the casino floor panel', 'info');
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
      const drawId = window.DrawEngine?.getSelectedDrawId?.() || 'monthly';
      const drawName = window.DrawEngine?.getSelectedDraw?.()?.name || 'draw';
      const ticket = wallet().redeemFreeTicket(selectedNumbers, drawId);

      window.DrawEngine?.registerTicket?.(drawId, ticket);
      window.DrawEngine?.syncWalletTicketsToDraws?.();

      const msg = `Free entry registered for ${drawName}. Good luck!`;
      if (status) { status.className = 'tx-status success'; status.textContent = msg; }
      window.AppUI?.toast(msg, 'success');
      selectedNumbers = [];
      renderNumberGrid();
      updateJackpot();
      renderActivityFeed();
      updateFreeTicketUI();
      updatePurchaseUI();
      window.PlayerDashboard?.refresh?.();
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
    const drawName = window.DrawEngine?.getSelectedDraw?.()?.name || 'selected draw';
    banner.hidden = n < 1;
    if (countEl) countEl.textContent = String(n);

    const textEl = banner.querySelector('.free-ticket-text');
    if (textEl && n > 0) {
      textEl.innerHTML = `You have <strong id="freeTicketCount">${n}</strong> free ticket${n === 1 ? '' : 's'} for <strong>${drawName}</strong>. Pick 6 numbers (or Quick Pick), then tap Redeem.`;
    }
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
    if (summary.checkoutEth > walletAfford.eth && walletAfford.eth > 0) {
      window.AppUI?.toast(`Insufficient balance. Max ticket ${TP().formatUsd(walletAfford.maxTicketUsd)}`, 'error');
      return;
    }
    if (summary.checkoutUsd < summary.minCheckoutUsd) {
      window.AppUI?.toast(`Minimum ticket is ${TP().formatUsd(summary.minCheckoutUsd)}`, 'error');
      return;
    }

    btn.disabled = true;
    if (status) {
      status.hidden = false;
      status.className = 'tx-status pending';
      status.textContent = summary.quantity > 1
        ? `Confirm ${summary.quantity} tickets in MetaMask (network fee is separate — paid to blockchain, not NeonDraw)...`
        : 'Confirm in MetaMask — ticket goes to pool; network fee goes to validators, not us...';
    }

    try {
      const tickets = await wallet().buyLotteryTicketBulk(
        summary.checkoutEth,
        selectedNumbers,
        summary.poolUsd,
        summary.quantity,
        summary.unitPoolUsd
      );
      const last = tickets[tickets.length - 1];

      if (window.DrawEngine) {
        tickets.forEach((t) => window.DrawEngine.registerTicket(window.DrawEngine.getSelectedDrawId(), t));
      }

      const msg = summary.quantity > 1
        ? `${summary.quantity} entries purchased — ${TP().formatUsd(summary.poolUsd)} added to pool!`
        : `Entry purchased — ${TP().formatUsd(summary.poolUsd)} added to pool!`;

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
    selection = { mode: 'tier', usd: 50, label: '$50', quantity: 1, offerId: null, offer: null };
    customAmountUsd = 100;

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
      customAmountUsd = Math.max(TP().MIN_TICKET_USD, parseInt(e.target.value, 10) || TP().MIN_TICKET_USD);
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
        walletAfford = { eth: 0, usd: 0, maxTicketUsd: 0 };
        updatePurchaseUI();
        updateFreeTicketUI();
      }
    });

    window.addEventListener('hashchange', () => {
      if (location.hash === '#lottery' || location.hash === '#pick-numbers') {
        updateFreeTicketUI();
      }
    });

    window.addEventListener('draw-selected', () => updateFreeTicketUI());

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
