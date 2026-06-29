/**
 * Live lottery activity feed — simulates global ticket purchase stream
 */
const ActivitySimulator = (() => {
  const LIVE_FEED_ENABLED = true;
  const STORAGE_KEY = 'starbitz_live_pool';
  const TICKET_AMOUNTS = [1, 5, 20, 34, 50, 75, 100, 150, 200, 300, 500];
  const INTERVAL_MS = { min: 2200, max: 6500 };

  let simulatedPool = 0;
  let simulatedTickets = 0;
  let feedItems = [];
  let timer = null;

  function randomHex(len) {
    return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  function fakeWallet() {
    return `0x${randomHex(4)}...${randomHex(4)}`;
  }

  function randomAmount() {
    const roll = Math.random();
    if (roll < 0.45) return TICKET_AMOUNTS[Math.floor(Math.random() * 5)];
    if (roll < 0.8) return TICKET_AMOUNTS[5 + Math.floor(Math.random() * 4)];
    return TICKET_AMOUNTS[9 + Math.floor(Math.random() * 2)];
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
    simulatedPool = parseFloat(localStorage.getItem(STORAGE_KEY) || '847293');
    simulatedTickets = parseInt(localStorage.getItem(STORAGE_KEY + '_count') || '1247', 10);
  }

  function savePool() {
    localStorage.setItem(STORAGE_KEY, simulatedPool.toFixed(2));
    localStorage.setItem(STORAGE_KEY + '_count', String(simulatedTickets));
  }

  function generateEvent() {
    const amount = randomAmount();
    simulatedPool += amount;
    simulatedTickets += 1;
    savePool();

    const event = {
      id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      wallet: fakeWallet(),
      numbers: randomNumbers(),
      usdPrice: amount,
      simulated: true,
      timestamp: Date.now(),
    };

    feedItems.unshift(event);
    feedItems = feedItems.slice(0, 40);

    window.dispatchEvent(new CustomEvent('lottery-activity', { detail: event }));
    return event;
  }

  function scheduleNext() {
    const delay = INTERVAL_MS.min + Math.random() * (INTERVAL_MS.max - INTERVAL_MS.min);
    timer = setTimeout(() => {
      generateEvent();
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
    return '$' + Math.round(n).toLocaleString();
  }

  function renderTicker() {
    const el = document.getElementById('liveTicker');
    if (!el || !feedItems.length) return;
    const latest = feedItems.slice(0, 8);
    el.innerHTML = latest.map((e) => `
      <span class="ticker-item">
        <strong>${e.wallet}</strong> bought ${formatUsd(e.usdPrice)} ticket
      </span>
    `).join('<span class="ticker-sep">•</span>');
  }

  function init() {
    if (!LIVE_FEED_ENABLED) return;
    loadPool();

    for (let i = 0; i < 12; i++) generateEvent();

    scheduleNext();

    window.addEventListener('lottery-activity', () => {
      renderTicker();
      window.LotteryApp?.onSimulatedActivity?.();
    });

    renderTicker();
  }

  function stop() {
    if (timer) clearTimeout(timer);
  }

  return {
    init, stop, isEnabled, getSimulatedPool, getSimulatedTicketCount,
    getFeedItems, generateEvent, formatUsd,
  };
})();

window.ActivitySimulator = ActivitySimulator;
