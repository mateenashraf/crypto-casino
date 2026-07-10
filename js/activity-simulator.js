/**
 * Live lottery activity feed, simulates global ticket purchase stream
 */
const ActivitySimulator = (() => {
  const LIVE_FEED_ENABLED = true;
  const STORAGE_KEY = 'live_pool';
  const STORAGE_COUNT = 'live_pool_count';

  let simulatedPool = 0;
  let simulatedTickets = 0;
  let feedItems = [];
  let timer = null;
  let sharedMode = false;
  let lastCrowd = null;

  function fakeWallet() {
    return window.SimPlayers?.pickWallet?.()
      || `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`;
  }

  function randomAmount() {
    return window.SimPlayers?.lotteryTicketUsd?.() ?? 10;
  }

  function currentPulse() {
    return lastCrowd || window.CrowdPulse?.getCrowdPulse?.() || {
      playersOnline: 2800,
      pace: 1,
      busy: false,
      note: '',
      cta: 'Pick your six and jump in.',
      label: 'Steady play',
    };
  }

  function applyCrowd(crowd) {
    if (!crowd) return;
    lastCrowd = crowd;
    renderCrowdNote();
  }

  function renderCrowdNote() {
    const el = document.getElementById('activityCrowdNote');
    if (!el) return;
    const pulse = currentPulse();
    const online = window.TrustDisplay?.getPlayersOnline?.() || pulse.playersOnline;
    const onlineLabel = window.PlatformStats?.formatCount?.(online) || String(online);
    const note = pulse.note || (pulse.busy ? 'Play is picking up.' : '');
    const cta = pulse.cta || 'Jump in and lock your numbers.';
    el.hidden = false;
    el.classList.toggle('is-busy', !!pulse.busy);
    el.innerHTML = note
      ? `<span class="activity-crowd-status">${note}</span> <span class="activity-crowd-online">${onlineLabel} online</span> · <a href="#pick-numbers" class="activity-crowd-cta">${cta}</a>`
      : `<span class="activity-crowd-online">${onlineLabel} players online</span> · <a href="#pick-numbers" class="activity-crowd-cta">${cta}</a>`;
  }

  function stopLocal() {
    sharedMode = true;
    if (timer) {
      clearTimeout(timer);
    }
    timer = null;
  }

  function ingestRemote(event) {
    if (!event?.id) return;
    stopLocal();
    if (feedItems.some((e) => e.id === event.id)) return;
    if (event.type === 'ticket' && event.usdPrice) {
      simulatedPool += Number(event.usdPrice) || 0;
      simulatedTickets += Math.max(1, Number(event.count) || 1);
      savePool();
      window.dispatchEvent(new CustomEvent('pool-updated'));
    }
    feedItems.unshift(event);
    feedItems = feedItems.slice(0, 40);
    onActivity(event.id);
  }

  function randomNumbers() {
    const pool = Array.from({ length: 49 }, (_, i) => i + 1);
    const nums = [];
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      nums.push(pool.splice(idx, 1)[0]);
    }
    return nums.sort((a, b) => a - b);
  }

  function loadPool() {
    const floor = window.PlatformStats?.DISPLAY_POOL_FLOOR ?? 1_000_000;
    const seedPool = window.PlatformStats?.SEED_SIM_POOL ?? 1_284_750;
    const seedTickets = window.PlatformStats?.SEED_SIM_TICKETS ?? 2_223_176;
    simulatedPool = parseFloat(SecureStorage.getRaw(STORAGE_KEY) || String(seedPool));
    simulatedTickets = parseInt(SecureStorage.getRaw(STORAGE_COUNT) || String(seedTickets), 10);
    // Migrate stale local seeds that contradict the live ledger
    if (simulatedPool < floor || simulatedTickets < seedTickets * 0.5) {
      simulatedPool = Math.max(simulatedPool, seedPool);
      simulatedTickets = Math.max(simulatedTickets, seedTickets);
      savePool();
    }
  }

  function recordRealPurchase({ usdAmount = 0, quantity = 1 } = {}) {
    const qty = Math.max(1, Math.floor(quantity));
    simulatedTickets += qty;
    savePool();
    window.dispatchEvent(new CustomEvent('pool-updated', { detail: { realUsd: usdAmount, quantity: qty } }));
  }

  function savePool() {
    SecureStorage.setRaw(STORAGE_KEY, simulatedPool.toFixed(2));
    SecureStorage.setRaw(STORAGE_COUNT, String(simulatedTickets));
  }

  function addWinEvent(entry) {
    if (!entry?.winner) return;

    const event = {
      id: `win-${entry.timestamp}-${entry.drawId}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'win',
      wallet: entry.winner.wallet,
      drawName: entry.drawName,
      prizeLabel: entry.prizeLabel || formatUsd(entry.prize || 0),
      prizeType: entry.prizeType,
      jackpotTierWin: !!entry.jackpotTierWin,
      numbers: entry.numbers,
      simulated: !entry.fromRealTicket,
      timestamp: entry.timestamp,
    };

    feedItems.unshift(event);
    feedItems = feedItems.slice(0, 40);
    window.dispatchEvent(new CustomEvent('lottery-activity', { detail: event }));
    return event;
  }

  function generateEvent(opts = {}) {
    if (sharedMode) return null;
    const amount = randomAmount();
    const qty = Math.max(1, Math.min(8, Math.floor(opts.count || 1)));
    simulatedPool += amount * qty;
    simulatedTickets += qty;
    savePool();

    const event = {
      id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      wallet: fakeWallet(),
      numbers: randomNumbers(),
      usdPrice: amount * qty,
      count: qty > 1 ? qty : undefined,
      simulated: true,
      timestamp: Date.now(),
    };

    feedItems.unshift(event);
    feedItems = feedItems.slice(0, 40);

    window.dispatchEvent(new CustomEvent('lottery-activity', { detail: event }));
    return event;
  }

  function scheduleNext() {
    if (sharedMode) return;
    const pulse = currentPulse();
    applyCrowd(pulse);
    const delay = window.CrowdPulse?.nextDelayMs?.(pulse)
      ?? (3500 + Math.random() * 7500);
    timer = setTimeout(() => {
      const n = window.CrowdPulse?.burstCount?.(pulse) ?? 1;
      for (let i = 0; i < n; i++) {
        const multi = pulse.busy && Math.random() < 0.25 ? 2 + Math.floor(Math.random() * 3) : 1;
        generateEvent({ count: multi });
      }
      if (!window.LiveFeed?.isShared?.()) {
        window.TrustDisplay?.applyCrowd?.(pulse);
      }
      scheduleNext();
    }, delay);
  }

  function getSimulatedPool() {
    return simulatedPool;
  }

  function getSimulatedTicketCount() {
    return simulatedTickets;
  }

  function getFeedItems() {
    return [...feedItems];
  }

  function isEnabled() {
    return LIVE_FEED_ENABLED;
  }

  function formatUsd(n) {
    return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  function getRealEvents() {
    const wallet = window.SecureWeb3;
    if (!wallet?.getAllTickets) return [];
    const groups = new Map();
    wallet.getAllTickets().forEach((t) => {
      const key = t.bundleTotal ? t.hash : t.id;
      if (!groups.has(key)) {
        groups.set(key, {
          id: t.id,
          wallet: wallet.shortenAddress(t.wallet),
          usdPrice: t.usdPrice,
          count: 1,
          simulated: false,
          timestamp: t.timestamp,
        });
      } else {
        const g = groups.get(key);
        g.count += 1;
        g.usdPrice += t.usdPrice;
        g.timestamp = Math.max(g.timestamp, t.timestamp);
      }
    });
    return [...groups.values()];
  }

  function getMergedItems() {
    const slotWins = window.SlotTicker?.getFeedItems?.() || [];
    const rouletteWins = window.RouletteTicker?.getFeedItems?.() || [];
    const byId = new Map();
    [...getRealEvents(), ...feedItems, ...slotWins, ...rouletteWins].forEach((e) => {
      const existing = byId.get(e.id);
      if (!existing || e.timestamp >= existing.timestamp) byId.set(e.id, e);
    });
    return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 24);
  }

  function formatTickerItem(e, highlightId) {
    if (e.type === 'slot_win' && window.SlotTicker?.formatTickerItem) {
      return window.SlotTicker.formatTickerItem(e, highlightId);
    }
    if (e.type === 'roulette_win' && window.RouletteTicker?.formatTickerItem) {
      return window.RouletteTicker.formatTickerItem(e, highlightId);
    }

    const isNew = e.id === highlightId;
    const isYou = !e.simulated
      && window.SecureWeb3?.isConnected?.()
      && e.wallet === window.SecureWeb3.shortenAddress(window.SecureWeb3.getAddress());

    if (e.type === 'win') {
      const prizeClass = e.prizeType === 'free_ticket'
        ? ' ticker-prize-ticket'
        : ' ticker-prize-cash';
      const youTag = isYou ? ' <em class="ticker-you">(you)</em>' : '';
      const when = new Date(e.timestamp).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
      return `<span class="ticker-item ticker-item-win${isNew ? ' ticker-item-new' : ''}${isYou ? ' ticker-item-you' : ''}">
        <strong>${e.wallet}</strong>${youTag} won <span class="ticker-amount${prizeClass}">${e.prizeLabel}</span>${e.jackpotTierWin ? ' <span class="ticker-tier-tag">top tier</span>' : ''} · ${e.drawName}
        <span class="ticker-when">${when}</span>
      </span>`;
    }

    const amount = formatUsd(e.usdPrice);
    const qtyTag = e.count > 1 ? ` <span class="ticker-qty">(${e.count}×)</span>` : '';
    const youTag = isYou ? ' <em class="ticker-you">(you)</em>' : '';
    return `<span class="ticker-item${isNew ? ' ticker-item-new' : ''}${isYou ? ' ticker-item-you' : ''}">
      <strong>${e.wallet}</strong>${youTag} bought <span class="ticker-amount">${amount}</span> ticket${e.count > 1 ? 's' : ''}${qtyTag}
    </span>`;
  }

  function renderTicker(highlightId) {
    const el = document.getElementById('liveTicker');
    if (!el) return;

    const items = getMergedItems();
    if (!items.length) {
      el.innerHTML = '<span class="ticker-item">Waiting for ticket purchases...</span>';
      return;
    }

    el.innerHTML = items.map((e) => formatTickerItem(e, highlightId)).join('<span class="ticker-sep">•</span>');

    if (highlightId) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
      const newEl = el.querySelector('.ticker-item-new');
      setTimeout(() => newEl?.classList.remove('ticker-item-new'), 2800);
    }
  }

  function onActivity(highlightId) {
    renderTicker(highlightId);
    renderCrowdNote();
    window.LotteryApp?.onSimulatedActivity?.();
  }

  function seedWinEventsFromWinners() {
    let winners = SecureStorage.getJSON('draw_winners', []);
    winners.slice(0, 5).forEach((entry) => {
      feedItems.push({
        id: `win-${entry.timestamp}-${entry.drawId}`,
        type: 'win',
        wallet: entry.winner?.wallet || fakeWallet(),
        drawName: entry.drawName,
        prizeLabel: entry.prizeLabel || formatUsd(entry.prize || 0),
        prizeType: entry.prizeType || 'cash',
        jackpotTierWin: !!entry.jackpotTierWin,
        numbers: entry.numbers,
        simulated: true,
        timestamp: entry.timestamp,
      });
    });
    feedItems.sort((a, b) => b.timestamp - a.timestamp);
    feedItems = feedItems.slice(0, 40);
  }

  function init() {
    if (!LIVE_FEED_ENABLED) return;
    loadPool();
    renderCrowdNote();

    window.addEventListener('lottery-activity', (ev) => {
      onActivity(ev.detail?.id);
    });

    window.addEventListener('slot-win', (ev) => {
      onActivity(ev.detail?.id);
    });

    window.addEventListener('roulette-win', (ev) => {
      onActivity(ev.detail?.id);
    });

    window.addEventListener('live-feed-sync', (ev) => {
      if (ev.detail?.shared) stopLocal();
      if (ev.detail?.crowd) applyCrowd(ev.detail.crowd);
    });

    window.addEventListener('crowd-pulse', (ev) => {
      if (ev.detail) applyCrowd(ev.detail);
    });

    window.SecureWeb3?.on?.((event, data) => {
      if (event === 'ticket-purchased' && data?.id) {
        recordRealPurchase({ usdAmount: data.usdTotal || data.usdPrice || 0, quantity: data.quantity || 1 });
        onActivity(data.id);
      }
      if (event === 'pool-updated') {
        window.PlatformStats?.renderPlatformMetrics?.();
        window.LotteryApp?.onSimulatedActivity?.();
      }
    });

    renderTicker();
    window.dispatchEvent(new CustomEvent('pool-updated'));

    setTimeout(() => {
      if (sharedMode || window.LiveFeed?.isShared?.()) {
        renderCrowdNote();
        return;
      }
      const pulse = currentPulse();
      applyCrowd(pulse);
      const seedN = pulse.busy ? 14 : 10;
      for (let i = 0; i < seedN; i++) {
        generateEvent({ count: pulse.busy && Math.random() < 0.3 ? 2 : 1 });
      }
      seedWinEventsFromWinners();
      scheduleNext();
      renderTicker();
      renderCrowdNote();
    }, 5500);
  }

  function stop() {
    if (timer) clearTimeout(timer);
  }

  return {
    init, stop, isEnabled, getSimulatedPool, getSimulatedTicketCount,
    getFeedItems, getMergedItems, generateEvent, formatUsd, renderTicker, addWinEvent,
    recordRealPurchase, ingestRemote, stopLocal, applyCrowd, renderCrowdNote,
  };
})();

window.ActivitySimulator = ActivitySimulator;
