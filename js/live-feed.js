/**
 * Shared live feed client - every visitor polls the same server authority.
 * Falls back to local simulation only if /api/live is unreachable (file open / offline).
 */
const LiveFeed = (() => {
  const POLL_MS = 3500;
  let timer = null;
  let lastIds = new Set();
  let sharedMode = false;
  let lastFeed = [];
  let lastWinners = [];
  let lastHistory = [];
  let lastCrowd = null;

  function base() {
    return window.__ND_CFG__?.apiBase || '';
  }

  async function fetchJson(path) {
    const res = await fetch(`${base()}${path}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`live ${res.status}`);
    return res.json();
  }

  function dispatchNewItems(items) {
    items.forEach((item) => {
      if (!item?.id || lastIds.has(item.id)) return;
      lastIds.add(item.id);
      if (item.type === 'slot_win') {
        window.dispatchEvent(new CustomEvent('slot-win', { detail: item }));
        window.SlotTicker?.ingestRemote?.(item);
      } else if (item.type === 'roulette_win') {
        window.dispatchEvent(new CustomEvent('roulette-win', { detail: item }));
        window.RouletteTicker?.ingestRemote?.(item);
      } else {
        window.dispatchEvent(new CustomEvent('lottery-activity', { detail: item }));
        window.ActivitySimulator?.ingestRemote?.(item);
      }
    });
    if (lastIds.size > 200) {
      lastIds = new Set([...lastIds].slice(-120));
    }
  }

  function applyCrowd(crowd) {
    if (!crowd) return;
    lastCrowd = crowd;
    window.TrustDisplay?.applyCrowd?.(crowd);
    window.ActivitySimulator?.applyCrowd?.(crowd);
    window.dispatchEvent(new CustomEvent('crowd-pulse', { detail: crowd }));
  }

  async function poll() {
    try {
      const [feed, winners, history] = await Promise.all([
        fetchJson('/api/live/feed'),
        fetchJson('/api/live/winners'),
        fetchJson('/api/live/jackpot-history').catch(() => null),
      ]);
      sharedMode = true;
      lastFeed = feed.items || [];
      lastWinners = winners || [];
      if (feed.crowd) applyCrowd(feed.crowd);
      if (history?.items) {
        lastHistory = history.items;
        window.dispatchEvent(new CustomEvent('jackpot-history-sync', {
          detail: { items: lastHistory, months: history.months || 15, shared: true },
        }));
      }
      dispatchNewItems(lastFeed);
      window.DrawEngine?.applySharedWinners?.(lastWinners);
      window.dispatchEvent(new CustomEvent('live-feed-sync', {
        detail: {
          items: lastFeed,
          winners: lastWinners,
          crowd: feed.crowd || lastCrowd,
          shared: true,
        },
      }));
    } catch {
      sharedMode = false;
    }
  }

  function init() {
    poll();
    timer = setInterval(poll, POLL_MS);
  }

  function stop() {
    if (timer) clearInterval(timer);
  }

  return {
    init,
    stop,
    isShared: () => sharedMode,
    getFeed: () => lastFeed.slice(),
    getWinners: () => lastWinners.slice(),
    getJackpotHistory: () => lastHistory.slice(),
    getCrowd: () => (lastCrowd ? { ...lastCrowd } : null),
  };
})();

window.LiveFeed = LiveFeed;
