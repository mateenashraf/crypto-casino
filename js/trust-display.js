/**
 * Trust & social-proof stats — uses PlatformStats for consistent numbers
 */
const TrustDisplay = (() => {
  let playersOnline = 1200 + Math.floor(Math.random() * 800);
  let timer = null;

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
    const delta = Math.floor(Math.random() * 41) - 18;
    playersOnline = Math.max(640, Math.min(3200, playersOnline + delta));
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
    formatUsd: (...args) => window.PlatformStats.formatUsd(...args),
  };
})();

window.TrustDisplay = TrustDisplay;
