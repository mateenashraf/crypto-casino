/**
 * Trust & social-proof stats, familiar signals for lottery / casino players
 */
const TrustDisplay = (() => {
  const BASE_PAID_OUT_USD = 2_847_500;
  const BASE_WINNERS = 14_280;
  const HERITAGE_YEAR = 1931;
  const CRYPTO_SINCE = 2019;
  let playersOnline = 1200 + Math.floor(Math.random() * 800);
  let timer = null;

  function formatUsd(n) {
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 10_000) return '$' + Math.round(n).toLocaleString();
    return '$' + Math.round(n).toLocaleString();
  }

  function formatCount(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 10_000) return Math.round(n / 1000) + 'K';
    return n.toLocaleString();
  }

  function sumWinnerPayouts() {
    let winners = [];
    try {
      winners = JSON.parse(localStorage.getItem('starbitz_draw_winners') || '[]');
    } catch { /* ignore */ }
    return winners.reduce((sum, w) => {
      if (w.prizeType === 'free_ticket') return sum + 1;
      return sum + (Number(w.prize) || Number(w.paidUsd) || 0);
    }, 0);
  }

  function getTicketCount() {
    const sim = window.ActivitySimulator?.getSimulatedTicketCount?.() || 0;
    const real = window.SecureWeb3?.getAllTickets?.()?.length || 0;
    return sim + real;
  }

  function tickPlayersOnline() {
    const delta = Math.floor(Math.random() * 41) - 18;
    playersOnline = Math.max(640, Math.min(3200, playersOnline + delta));
    const el = document.getElementById('statPlayersOnline');
    if (el) el.textContent = formatCount(playersOnline);
  }

  function render() {
    const paid = BASE_PAID_OUT_USD + sumWinnerPayouts();
    const tickets = getTicketCount();
    const winnerTotal = BASE_WINNERS + (JSON.parse(localStorage.getItem('starbitz_draw_winners') || '[]').length || 0);

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('statPaidOut', formatUsd(paid));
    set('statTickets', formatCount(tickets));
    set('statPlayersOnline', formatCount(playersOnline));
    set('statWinnersTotal', formatCount(winnerTotal));
    set('trustPaidOutBanner', formatUsd(paid));
    set('heritageYears', String(new Date().getFullYear() - HERITAGE_YEAR));
    set('heritageSince', String(HERITAGE_YEAR));
    set('cryptoSince', String(CRYPTO_SINCE));
  }

  function init() {
    render();
    timer = setInterval(() => {
      tickPlayersOnline();
      render();
    }, 12000);

    window.addEventListener('draw-completed', () => render());
    window.addEventListener('lottery-activity', () => {
      const el = document.getElementById('statTickets');
      if (el) el.textContent = formatCount(getTicketCount());
    });
  }

  function stop() {
    if (timer) clearInterval(timer);
  }

  return { init, stop, render, formatUsd };
})();

window.TrustDisplay = TrustDisplay;
