/**
 * NeonDraw Slots — 25% paid win / 75% loss; free spins ~10% daily win cap
 */
const SlotMachine = (() => {
  const STORAGE = 'starbitz_slot_history';
  const STORAGE_FREE = 'starbitz_free_spins_daily';
  const PAID_WIN_RATE = 0.25;
  const FREE_WIN_RATE = 0.10;
  const FREE_SPINS_PER_DAY = 3;
  const FREE_TICKETS_PER_DAY = 2;
  const SYMBOLS = ['cherry', 'lemon', 'star', 'gem', 'crown', 'zap'];
  const PAYOUT_MULT = { cherry: 2, lemon: 2, star: 5, gem: 8, crown: 15, zap: 25 };

  let spinning = false;

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadFreeDaily() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_FREE) || '{}');
      if (data.day !== todayKey()) {
        return { day: todayKey(), freeSpinsUsed: 0, freeTicketsUsed: 0, freeWins: 0, freePlays: 0 };
      }
      return data;
    } catch {
      return { day: todayKey(), freeSpinsUsed: 0, freeTicketsUsed: 0, freeWins: 0, freePlays: 0 };
    }
  }

  function saveFreeDaily(data) {
    localStorage.setItem(STORAGE_FREE, JSON.stringify({ ...data, day: todayKey() }));
  }

  function pickSymbol() {
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  }

  function spinReels(forceWin) {
    if (forceWin) {
      const s = pickSymbol();
      return [s, s, s];
    }
    return [pickSymbol(), pickSymbol(), pickSymbol()];
  }

  function isWin(reels) {
    return reels[0] === reels[1] && reels[1] === reels[2];
  }

  function canFreeWin(freeState) {
    if (freeState.freePlays === 0) return Math.random() < FREE_WIN_RATE;
    const currentRate = freeState.freeWins / freeState.freePlays;
    if (currentRate >= FREE_WIN_RATE) return false;
    return Math.random() < FREE_WIN_RATE;
  }

  function recordPlay(wallet, { betUsd, payoutUsd, won, free, reels }) {
    const list = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    list.unshift({
      wallet,
      betUsd,
      payoutUsd,
      won,
      free,
      reels,
      timestamp: Date.now(),
    });
    localStorage.setItem(STORAGE, JSON.stringify(list.slice(0, 500)));
    window.dispatchEvent(new CustomEvent('slot-played', { detail: { won, payoutUsd } }));
  }

  function animateReels(reels, resultEl, onDone) {
    const reelEls = document.querySelectorAll('#neonSlotReels .slot-reel-icon');
    reelEls.forEach((el, i) => {
      el.dataset.icon = reels[i];
      window.Icons?.hydrate?.(el.parentElement || el);
    });
    setTimeout(onDone, 900);
  }

  async function play({ free = false, betUsd = 1 }) {
    if (spinning) return;
    const wallet = window.SecureWeb3?.getAddress?.();
    if (!wallet) {
      window.AppUI?.toast?.('Connect wallet to spin', 'info');
      window.AppUI?.openWallet?.();
      return;
    }

    spinning = true;
    const freeState = loadFreeDaily();
    let won = false;
    let payoutUsd = 0;

    if (free) {
      if (freeState.freeSpinsUsed >= FREE_SPINS_PER_DAY) {
        window.AppUI?.toast?.('No free spins left today', 'info');
        spinning = false;
        return;
      }
      freeState.freeSpinsUsed += 1;
      freeState.freePlays += 1;
      won = canFreeWin(freeState);
      if (won) {
        freeState.freeWins += 1;
        payoutUsd = 0.5 + Math.random() * 4;
        window.SecureWeb3?.grantFreeTickets?.(wallet, 1, { source: 'free_spin' });
      }
      saveFreeDaily(freeState);
    } else {
      const casinoBal = window.SecureWeb3?.getCasinoBalance?.(wallet) || 0;
      const betEth = betUsd / (window.PoolPolicy?.POLICY?.ETH_USD || 3500);
      if (betEth > casinoBal && betUsd > 0) {
        window.AppUI?.toast?.('Deposit to casino balance first', 'error');
        spinning = false;
        return;
      }
      if (betUsd > 0) {
        window.SecureWeb3?.setCasinoBalance?.(wallet, casinoBal - betEth);
      }
      won = Math.random() < PAID_WIN_RATE;
      if (won) {
        const sym = pickSymbol();
        const mult = PAYOUT_MULT[sym] || 3;
        payoutUsd = betUsd * mult * 0.4;
        const creditEth = payoutUsd / (window.PoolPolicy?.POLICY?.ETH_USD || 3500);
        const approval = window.PoolPolicy?.processDrawPayout?.(payoutUsd, wallet, { source: 'slot' });
        if (approval?.auto) {
          window.SecureWeb3?.setCasinoBalance?.(wallet, (window.SecureWeb3?.getCasinoBalance?.(wallet) || 0) + creditEth);
        }
      }
    }

    const reels = spinReels(won);
    const resultEl = document.getElementById('neonSlotResult');
    if (resultEl) resultEl.textContent = 'Spinning…';

    animateReels(reels, resultEl, () => {
      const msg = won
        ? `WIN! +$${payoutUsd.toFixed(2)}${free ? ' + free ticket' : ''}`
        : 'No win this spin';
      if (resultEl) {
        resultEl.textContent = msg;
        resultEl.className = `slot-result ${won ? 'win' : 'loss'}`;
      }
      const explainEl = document.getElementById('neonSlotExplain');
      if (explainEl) {
        explainEl.textContent = window.ProvablyFair?.explainOutcome?.(won, free ? 'slot_free' : 'slot_paid') || '';
      }
      recordPlay(wallet, { betUsd: free ? 0 : betUsd, payoutUsd, won, free, reels });
      updateFreeUI();
      spinning = false;
    });
  }

  function updateFreeUI() {
    const freeState = loadFreeDaily();
    const spinsLeft = Math.max(0, FREE_SPINS_PER_DAY - freeState.freeSpinsUsed);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('freeSpinsLeft', String(spinsLeft));
    set('freeTicketsLeft', String(Math.max(0, FREE_TICKETS_PER_DAY - freeState.freeTicketsUsed)));
    set('freeWinRateNote', `Free wins today: ${freeState.freeWins}/${freeState.freePlays} (10% daily cap)`);
  }

  function init() {
    updateFreeUI();
    document.getElementById('neonSlotSpinBtn')?.addEventListener('click', () => {
      const bet = parseFloat(document.getElementById('neonSlotBet')?.value || '1');
      play({ free: false, betUsd: bet });
    });
    document.getElementById('neonSlotFreeBtn')?.addEventListener('click', () => play({ free: true }));
    document.getElementById('neonSlotGrantFreeTicket')?.addEventListener('click', () => {
      const wallet = window.SecureWeb3?.getAddress?.();
      if (!wallet) { window.AppUI?.openWallet?.(); return; }
      const freeState = loadFreeDaily();
      if (freeState.freeTicketsUsed >= FREE_TICKETS_PER_DAY) {
        window.AppUI?.toast?.('Daily free tickets claimed', 'info');
        return;
      }
      freeState.freeTicketsUsed += 1;
      saveFreeDaily(freeState);
      window.SecureWeb3?.grantFreeTickets?.(wallet, 1, { source: 'daily_bonus' });
      window.AppUI?.toast?.('Free ticket added!', 'success');
      updateFreeUI();
    });

    const reelsWrap = document.getElementById('neonSlotReels');
    if (reelsWrap) {
      reelsWrap.innerHTML = SYMBOLS.slice(0, 3).map((s) =>
        `<div class="slot-reel"><span class="slot-reel-icon" data-icon="${s}" data-icon-size="40"></span></div>`
      ).join('');
      window.Icons?.hydrate?.(reelsWrap);
    }
  }

  return {
    init,
    play,
    PAID_WIN_RATE,
    FREE_WIN_RATE,
    updateFreeUI,
  };
})();

window.SlotMachine = SlotMachine;
