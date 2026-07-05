/**
 * Live slot win ticker — simulated wins + real player hits on NeonDraw Slots
 */
const SlotTicker = (() => {
  const ENABLED = true;
  const INTERVAL_MS = { min: 3500, max: 11_000 };
  const BETS = [0.5, 1, 2, 5, 10, 25];

  const SYMBOLS = window.SlotSymbols?.getCatalog?.() || [
    { id: 'cherry', label: 'Cherry', mult: 2 },
    { id: 'orange', label: 'Orange', mult: 3 },
    { id: 'bell', label: 'Bell', mult: 5 },
    { id: 'crown', label: 'Crown', mult: 15 },
    { id: 'seven', label: 'Lucky 7', mult: 25 },
  ];

  let feedItems = [];
  let timer = null;

  function randomHex(len) {
    return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  function fakeWallet() {
    return `0x${randomHex(4)}...${randomHex(4)}`;
  }

  function formatUsd(n) {
    if (window.PlatformStats?.formatUsd) return window.PlatformStats.formatUsd(n);
    const v = Number(n) || 0;
    if (v >= 1000) return '$' + Math.round(v).toLocaleString();
    return '$' + v.toFixed(2);
  }

  function getSymbol(id) {
    return SYMBOLS.find((s) => s.id === id) || SYMBOLS[0];
  }

  function buildWinEvent({ wallet, symbolId, betUsd, payoutUsd, free, simulated, timestamp }) {
    const sym = getSymbol(symbolId);
    const ts = timestamp ?? Date.now();
    return {
      id: `slot-${ts}-${Math.random().toString(36).slice(2, 8)}`,
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

  function generateWin(dispatch = true) {
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const betUsd = BETS[Math.floor(Math.random() * BETS.length)];
    const payoutUsd = betUsd * sym.mult * (0.35 + Math.random() * 0.15);
    const event = buildWinEvent({
      wallet: fakeWallet(),
      symbolId: sym.id,
      betUsd,
      payoutUsd,
      free: Math.random() < 0.12,
      simulated: true,
    });

    feedItems.unshift(event);
    feedItems = feedItems.slice(0, 36);

    if (dispatch) {
      window.dispatchEvent(new CustomEvent('slot-win', { detail: event }));
    }
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
      const newEl = el.querySelector('.ticker-item-new');
      setTimeout(() => newEl?.classList.remove('ticker-item-new'), 2800);
    }
  }

  function scheduleNext() {
    const delay = INTERVAL_MS.min + Math.random() * (INTERVAL_MS.max - INTERVAL_MS.min);
    timer = setTimeout(() => {
      generateWin(true);
      scheduleNext();
    }, delay);
  }

  function init() {
    if (!ENABLED) return;

    for (let i = 0; i < 7; i++) generateWin(false);
    renderLocalTicker();
    scheduleNext();

    window.addEventListener('slot-win', (ev) => {
      renderLocalTicker(ev.detail?.id);
    });
  }

  function stop() {
    if (timer) clearTimeout(timer);
  }

  return {
    init,
    stop,
    getFeedItems: () => feedItems.slice(),
    formatTickerItem,
    addWin,
    generateWin,
    renderLocalTicker,
  };
})();

window.SlotTicker = SlotTicker;
