/**
 * Trust & social-proof stats — uses PlatformStats for consistent numbers
 */
const TrustDisplay = (() => {
  const SEED = window.PlatformStats?.SEED_PLAYERS_ONLINE ?? 2840;
  let playersOnline = SEED + Math.floor(Math.random() * 400);
  let timer = null;

  function getPlayersOnline() {
    return playersOnline;
  }

  function render() {
    const ps = window.PlatformStats;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('statPlayersOnline', ps.formatCount(playersOnline));
    set('heritageYears', String(new Date().getFullYear() - ps.HERITAGE_YEAR));
    set('heritageSince', String(ps.HERITAGE_YEAR));
    set('cryptoSince', String(ps.CRYPTO_SINCE));
  }

  function renderPlatformTotals() {
    window.PlatformStats.renderPlatformMetrics();
  }

  function tickPlayersOnline() {
    const delta = Math.floor(Math.random() * 61) - 22;
    playersOnline = Math.max(2200, Math.min(5800, playersOnline + delta));
    const el = document.getElementById('statPlayersOnline');
    if (el) el.textContent = window.PlatformStats.formatCount(playersOnline);
  }

  function init() {
    renderPlatformTotals();
    render();
    timer = setInterval(() => {
      tickPlayersOnline();
      render();
    }, 12000);

    window.addEventListener('draw-completed', () => renderPlatformTotals());
    window.addEventListener('lottery-activity', () => renderPlatformTotals());
    window.addEventListener('pool-updated', () => renderPlatformTotals());
  }

  function stop() {
    if (timer) clearInterval(timer);
  }

  return {
    init,
    stop,
    render,
    getPlayersOnline,
    formatUsd: (...args) => window.PlatformStats.formatUsd(...args),
  };
})();

window.TrustDisplay = TrustDisplay;
