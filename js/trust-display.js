/**
 * Trust & social-proof stats - players online tracks live crowd pulse
 */
const TrustDisplay = (() => {
  const SEED = window.PlatformStats?.SEED_PLAYERS_ONLINE ?? 2840;
  let playersOnline = SEED + Math.floor(Math.random() * 400);
  let timer = null;
  let lastCrowd = null;

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

  function applyCrowd(crowd) {
    if (!crowd?.playersOnline) return;
    lastCrowd = crowd;
    // Ease toward server/local pulse so the stat bar matches feed speed
    const target = crowd.playersOnline;
    playersOnline = Math.round(playersOnline * 0.55 + target * 0.45);
    playersOnline = Math.max(1800, Math.min(6200, playersOnline));
    render();
    renderPlatformTotals();
  }

  function tickPlayersOnline() {
    if (window.LiveFeed?.isShared?.() && lastCrowd?.playersOnline) {
      const jitter = Math.floor(Math.random() * 41) - 16;
      playersOnline = Math.max(1800, Math.min(6200, lastCrowd.playersOnline + jitter));
    } else {
      const pulse = window.CrowdPulse?.getCrowdPulse?.() || { playersOnline: SEED, pace: 1 };
      const delta = Math.floor((Math.random() * 50 - 18) * (pulse.pace || 1));
      playersOnline = Math.max(1800, Math.min(6200, Math.round(
        playersOnline * 0.7 + pulse.playersOnline * 0.3 + delta
      )));
      applyCrowd({ ...pulse, playersOnline });
      return;
    }
    render();
  }

  function init() {
    const pulse = window.CrowdPulse?.getCrowdPulse?.();
    if (pulse) applyCrowd(pulse);
    renderPlatformTotals();
    render();
    timer = setInterval(() => {
      tickPlayersOnline();
      render();
    }, 9000);

    window.addEventListener('draw-completed', () => renderPlatformTotals());
    window.addEventListener('lottery-activity', () => renderPlatformTotals());
    window.addEventListener('pool-updated', () => renderPlatformTotals());
    window.addEventListener('crowd-pulse', (ev) => {
      if (ev.detail) applyCrowd(ev.detail);
    });
  }

  function stop() {
    if (timer) clearInterval(timer);
  }

  return {
    init,
    stop,
    render,
    getPlayersOnline,
    applyCrowd,
    formatUsd: (...args) => window.PlatformStats.formatUsd(...args),
  };
})();

window.TrustDisplay = TrustDisplay;
