/**
 * Live roulette win ticker: prefers shared server feed for all visitors.
 */
const RouletteTicker = (() => {
  const ENABLED = true;
  const INTERVAL_MS = { min: 4000, max: 12_000 };
  const BET_TYPES = ['red', 'black', 'even', 'odd', 'low', 'high'];
  const BET_LABELS = {
    red: 'Red', black: 'Black', even: 'Even', odd: 'Odd', low: '1-18', high: '19-36',
  };
  const RESULTS = window.Roulette?.WHEEL_ORDER || [
    '0', '28', '9', '26', '30', '11', '7', '20', '32', '17', '5', '22', '34', '15', '3', '24', '36', '13', '1',
    '00', '27', '10', '25', '29', '12', '8', '19', '31', '18', '6', '21', '33', '16', '4', '23', '35', '14', '2',
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

  function buildWinEvent({ wallet, betType, result, betUsd, payoutUsd, simulated, timestamp, id }) {
    const ts = timestamp ?? Date.now();
    return {
      id: id || `roulette-${ts}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'roulette_win',
      wallet,
      betType,
      betLabel: BET_LABELS[betType] || betType,
      result,
      resultColor: window.Roulette?.slotColor?.(result) || 'black',
      betUsd: Number(betUsd) || 0,
      payoutUsd: Number(payoutUsd) || 0,
      payoutLabel: formatUsd(payoutUsd),
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
    let event = null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const betType = BET_TYPES[Math.floor(Math.random() * BET_TYPES.length)];
      const result = RESULTS[Math.floor(Math.random() * RESULTS.length)];
      if (!window.Roulette?.checkWin?.(betType, result)) continue;
      const betUsd = players?.rouletteBet?.() ?? 5;
      const payoutUsd = players?.roulettePayout?.(betUsd) ?? betUsd * 2;
      event = buildWinEvent({
        wallet: players?.pickWallet?.() || '0xabcd...ef01',
        betType,
        result,
        betUsd,
        payoutUsd,
        simulated: true,
      });
      break;
    }
    if (!event) {
      event = buildWinEvent({
        wallet: players?.pickWallet?.() || '0xabcd...ef01',
        betType: 'red',
        result: '1',
        betUsd: 5,
        payoutUsd: 10,
        simulated: true,
      });
    }
    feedItems.unshift(event);
    feedItems = feedItems.slice(0, 36);
    if (dispatch) window.dispatchEvent(new CustomEvent('roulette-win', { detail: event }));
    return event;
  }

  function addWin({ wallet, betType, result, betUsd, payoutUsd }) {
    if (!wallet) return null;
    const event = buildWinEvent({
      wallet: window.SecureWeb3?.shortenAddress?.(wallet) || wallet,
      betType,
      result,
      betUsd,
      payoutUsd,
      simulated: false,
    });
    feedItems.unshift(event);
    feedItems = feedItems.slice(0, 36);
    window.dispatchEvent(new CustomEvent('roulette-win', { detail: event }));
    return event;
  }

  function formatTickerItem(e, highlightId) {
    const isNew = e.id === highlightId;
    const isYou = !e.simulated
      && window.SecureWeb3?.isConnected?.()
      && e.wallet === window.SecureWeb3.shortenAddress(window.SecureWeb3.getAddress());
    const youTag = isYou ? ' <em class="ticker-you">(you)</em>' : '';
    const when = new Date(e.timestamp).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    return `<span class="ticker-item ticker-item-roulette${isNew ? ' ticker-item-new' : ''}${isYou ? ' ticker-item-you' : ''}">
      <span class="roulette-ticker-chip roulette-result-${e.resultColor}">${e.result}</span>
      <strong>${e.wallet}</strong>${youTag} won <span class="ticker-amount">${e.payoutLabel}</span> on ${e.betLabel}
      <span class="ticker-when">${when}</span>
    </span>`;
  }

  function renderLocalTicker(highlightId) {
    const el = document.getElementById('rouletteLiveTicker');
    if (!el) return;
    const wins = feedItems.slice(0, 18);
    if (!wins.length) {
      el.innerHTML = '<span class="ticker-item">Waiting for roulette wins…</span>';
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
    window.addEventListener('roulette-win', (ev) => renderLocalTicker(ev.detail?.id));
    window.addEventListener('live-feed-sync', (ev) => {
      if (ev.detail?.shared) stopLocal();
    });
    setTimeout(() => {
      if (sharedMode || window.LiveFeed?.isShared?.()) return;
      for (let i = 0; i < 4; i++) generateWin(false);
      renderLocalTicker();
      scheduleNext();
    }, 5500);
  }

  return {
    init,
    getFeedItems: () => feedItems.slice(),
    formatTickerItem,
    addWin,
    renderLocalTicker,
    ingestRemote,
    stopLocal,
  };
})();

window.RouletteTicker = RouletteTicker;
