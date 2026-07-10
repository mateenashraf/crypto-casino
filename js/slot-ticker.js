/**
 * Live slot win ticker: prefers shared server feed so every visitor sees the same wins.
 */
const SlotTicker = (() => {
  const ENABLED = true;
  const INTERVAL_MS = { min: 3500, max: 11_000 };

  const SYMBOLS = window.SlotSymbols?.getCatalog?.() || [
    { id: 'cherry', label: 'Cherry', mult: 2 },
    { id: 'orange', label: 'Orange', mult: 3 },
    { id: 'bell', label: 'Bell', mult: 5 },
    { id: 'crown', label: 'Crown', mult: 15 },
    { id: 'seven', label: 'Lucky 7', mult: 25 },
  ];

  let feedItems = [];
  let timer = null;
  let sharedMode = false;

  function formatUsd(n) {
    if (window.PlatformStats?.formatUsd) return window.PlatformStats.formatUsd(n);
    const v = Number(n) || 0;
    if (v >= 1000) return '$' + Math.round(v).toLocaleString();
    return '$' + v.toFixed(2);
  }

  function getSymbol(id) {
    return SYMBOLS.find((s) => s.id === id) || SYMBOLS[0];
  }

  function buildWinEvent({ wallet, symbolId, betUsd, payoutUsd, free, simulated, timestamp, id }) {
    const sym = getSymbol(symbolId);
    const ts = timestamp ?? Date.now();
    return {
      id: id || `slot-${ts}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'slot_win',
      wallet,
      symbol: sym.id,
      symbolLabel: sym.label,
      betUsd: Number(betUsd) || 0,
      payoutUsd: Number(payoutUsd) || 0,
      payoutLabel: formatUsd(payoutUsd),
      free: !!free,
      simulated: simulated !== false,
      timestamp: ts,
    };
  }

  function ingestRemote(event) {
    if (!event?.id) return;
    stopLocal();
    if (feedItems.some((e) => e.id === event.id)) return;
    feedItems.unshift(event);
    feedItems = feedItems.slice(0, 36);
    renderLocalTicker(event.id);
  }

  function stopLocal() {
    sharedMode = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function generateWin(dispatch = true) {
    if (sharedMode) return null;
    const players = window.SimPlayers;
    const symbolId = players?.slotSymbolId?.(SYMBOLS) || SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].id;
    const sym = getSymbol(symbolId);
    const free = Math.random() < 0.10;
    const betUsd = free ? 0 : (players?.slotBet?.() ?? 2);
    const payoutUsd = players?.slotPayout?.(betUsd || 1, sym.mult, { free })
      ?? (betUsd * (sym.mult || 2) * 0.4);

    const event = buildWinEvent({
      wallet: players?.pickWallet?.() || `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
      symbolId: sym.id,
      betUsd,
      payoutUsd,
      free,
      simulated: true,
    });

    feedItems.unshift(event);
    feedItems = feedItems.slice(0, 36);
    if (dispatch) window.dispatchEvent(new CustomEvent('slot-win', { detail: event }));
    return event;
  }

  function addWin({ wallet, reels, betUsd, payoutUsd, won, free }) {
    if (!won || !wallet) return null;
    const symbolId = Array.isArray(reels) && reels[0] ? reels[0] : 'cherry';
    const event = buildWinEvent({
      wallet: window.SecureWeb3?.shortenAddress?.(wallet) || wallet,
      symbolId,
      betUsd,
      payoutUsd,
      free,
      simulated: false,
    });
    feedItems.unshift(event);
    feedItems = feedItems.slice(0, 36);
    window.dispatchEvent(new CustomEvent('slot-win', { detail: event }));
    return event;
  }

  function formatTickerItem(e, highlightId) {
    const isNew = e.id === highlightId;
    const isYou = !e.simulated
      && window.SecureWeb3?.isConnected?.()
      && e.wallet === window.SecureWeb3.shortenAddress(window.SecureWeb3.getAddress());
    const youTag = isYou ? ' <em class="ticker-you">(you)</em>' : '';
    const freeTag = e.free ? ' <span class="ticker-slot-free">free spin</span>' : '';
    const when = new Date(e.timestamp).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const symArt = window.SlotSymbols?.render?.(e.symbol)
      ? `<span class="ticker-slot-art">${window.SlotSymbols.render(e.symbol)}</span>`
      : `<span class="ticker-slot-fallback">${e.symbolLabel}</span>`;
    return `<span class="ticker-item ticker-item-slot${isNew ? ' ticker-item-new' : ''}${isYou ? ' ticker-item-you' : ''}">
      ${symArt}
      <strong>${e.wallet}</strong>${youTag} won <span class="ticker-amount">${e.payoutLabel}</span>${freeTag} · ${e.symbolLabel} ×3
      <span class="ticker-when">${when}</span>
    </span>`;
  }

  function renderLocalTicker(highlightId) {
    const el = document.getElementById('slotLiveTicker');
    if (!el) return;
    const wins = feedItems.slice(0, 18);
    if (!wins.length) {
      el.innerHTML = '<span class="ticker-item">Waiting for slot wins…</span>';
      return;
    }
    el.innerHTML = wins.map((e) => formatTickerItem(e, highlightId)).join('<span class="ticker-sep">•</span>');
    if (highlightId) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
      setTimeout(() => el.querySelector('.ticker-item-new')?.classList.remove('ticker-item-new'), 2800);
    }
  }

  function scheduleNext() {
    if (sharedMode) return;
    const delay = INTERVAL_MS.min + Math.random() * (INTERVAL_MS.max - INTERVAL_MS.min);
    timer = setTimeout(() => {
      generateWin(true);
      scheduleNext();
    }, delay);
  }

  function init() {
    if (!ENABLED) return;
    renderLocalTicker();
    window.addEventListener('slot-win', (ev) => renderLocalTicker(ev.detail?.id));
    window.addEventListener('live-feed-sync', (ev) => {
      if (ev.detail?.shared) stopLocal();
    });
    setTimeout(() => {
      if (sharedMode || window.LiveFeed?.isShared?.()) return;
      for (let i = 0; i < 5; i++) generateWin(false);
      renderLocalTicker();
      scheduleNext();
    }, 5500);
  }

  return {
    init,
    getFeedItems: () => feedItems.slice(),
    formatTickerItem,
    addWin,
    generateWin,
    renderLocalTicker,
    ingestRemote,
    stopLocal,
  };
})();

window.SlotTicker = SlotTicker;
