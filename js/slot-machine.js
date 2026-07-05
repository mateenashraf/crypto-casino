/**
 * NeonDraw Slots — colorful Vegas-style cabinet with animated reels
 */
const SlotMachine = (() => {
  const STORAGE = 'starbitz_slot_history';
  const STORAGE_FREE = 'starbitz_free_spins_daily';
  const PAID_WIN_RATE = 0.25;
  const FREE_WIN_RATE = 0.10;
  const FREE_SPINS_PER_DAY = 3;
  const FREE_TICKETS_PER_DAY = 2;
  const SYMBOL_HEIGHT = 92;
  const STRIP_LENGTH = 30;

  const SYMBOLS = [
    { id: 'cherry', emoji: '🍒', label: 'Cherry', color: '#ff4d6d', bg: 'linear-gradient(160deg, #3d1020 0%, #1a0a12 100%)' },
    { id: 'lemon', emoji: '🍋', label: 'Lemon', color: '#ffd93d', bg: 'linear-gradient(160deg, #3d3510 0%, #1a1808 100%)' },
    { id: 'star', emoji: '⭐', label: 'Star', color: '#ffc94d', bg: 'linear-gradient(160deg, #3d2e10 0%, #1a1408 100%)' },
    { id: 'gem', emoji: '💎', label: 'Diamond', color: '#5eead4', bg: 'linear-gradient(160deg, #103d38 0%, #081a18 100%)' },
    { id: 'crown', emoji: '👑', label: 'Crown', color: '#f5b731', bg: 'linear-gradient(160deg, #3d3010 0%, #1a1608 100%)' },
    { id: 'seven', emoji: '7️⃣', label: 'Lucky 7', color: '#a78bfa', bg: 'linear-gradient(160deg, #2a1848 0%, #120a24 100%)' },
  ];

  const PAYOUT_MULT = { cherry: 2, lemon: 2, star: 5, gem: 8, crown: 15, seven: 25 };

  let spinning = false;
  let marqueeTimer = null;

  function getSymbol(id) {
    return SYMBOLS.find((s) => s.id === id) || SYMBOLS[0];
  }

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
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].id;
  }

  function spinReels(forceWin) {
    if (forceWin) {
      const s = pickSymbol();
      return [s, s, s];
    }
    const a = pickSymbol();
    let b = pickSymbol();
    let c = pickSymbol();
    if (a === b && b === c) c = SYMBOLS[(SYMBOLS.findIndex((x) => x.id === c) + 1) % SYMBOLS.length].id;
    return [a, b, c];
  }

  function canFreeWin(freeState) {
    if (freeState.freePlays === 0) return Math.random() < FREE_WIN_RATE;
    const currentRate = freeState.freeWins / freeState.freePlays;
    if (currentRate >= FREE_WIN_RATE) return false;
    return Math.random() < FREE_WIN_RATE;
  }

  function recordPlay(wallet, { betUsd, payoutUsd, won, free, reels }) {
    const list = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    list.unshift({ wallet, betUsd, payoutUsd, won, free, reels, timestamp: Date.now() });
    localStorage.setItem(STORAGE, JSON.stringify(list.slice(0, 500)));
    window.dispatchEvent(new CustomEvent('slot-played', { detail: { won, payoutUsd, betUsd, free, reels, wallet } }));
    if (won) {
      window.SlotTicker?.addWin?.({ wallet, reels, betUsd, payoutUsd, won, free });
    }
  }

  function renderSymbolCell(sym) {
    return `
      <div class="slot-symbol" data-symbol="${sym.id}" style="--sym-color:${sym.color};--sym-bg:${sym.bg}">
        <span class="slot-emoji" role="img" aria-label="${sym.label}">${sym.emoji}</span>
        <span class="slot-symbol-glow"></span>
      </div>`;
  }

  function buildStrip(finalSymbolId) {
    const cells = [];
    for (let i = 0; i < STRIP_LENGTH - 1; i++) {
      cells.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    }
    cells.push(getSymbol(finalSymbolId));
    return cells.map(renderSymbolCell).join('');
  }

  function buildReelsHTML(finals = ['cherry', 'lemon', 'star']) {
    return finals.map((sym, i) => `
      <div class="slot-reel-col" data-reel="${i}">
        <div class="slot-reel-viewport">
          <div class="slot-reel-strip" style="transform: translateY(-${(STRIP_LENGTH - 1) * SYMBOL_HEIGHT}px)">
            ${buildStrip(sym)}
          </div>
        </div>
      </div>`).join('');
  }

  function buildLights() {
    const el = document.querySelector('#neonSlotCabinet .slot-lights');
    if (!el || el.childElementCount) return;
    const colors = ['#ff6b9d', '#f5b731', '#7c5cfc', '#00d68f', '#ff8c00', '#5eead4'];
    el.innerHTML = Array.from({ length: 14 }, (_, i) =>
      `<span class="slot-light" style="--light-color:${colors[i % colors.length]};--light-delay:${i * 0.12}s"></span>`
    ).join('');
  }

  function startMarquee() {
    const el = document.getElementById('slotMarquee');
    if (!el) return;
    const msgs = [
      '★ NEON DRAW JACKPOT ★',
      '★ MATCH 3 TO WIN ★',
      '★ VEGAS LUCKY 7s ★',
      '★ SPIN & WIN ★',
    ];
    let i = 0;
    marqueeTimer = setInterval(() => {
      i = (i + 1) % msgs.length;
      el.textContent = msgs[i];
    }, 3200);
  }

  function setCabinetState(state) {
    const cab = document.getElementById('neonSlotCabinet');
    if (!cab) return;
    cab.classList.remove('is-spinning', 'is-win', 'is-loss');
    if (state) cab.classList.add(state);
  }

  function pullLever() {
    const lever = document.querySelector('.slot-lever');
    if (!lever) return;
    lever.classList.add('pulled');
    setTimeout(() => lever.classList.remove('pulled'), 600);
  }

  function animateReels(finalIds, onDone) {
    const cols = document.querySelectorAll('#neonSlotReels .slot-reel-col');
    if (!cols.length) {
      onDone();
      return;
    }

    setCabinetState('is-spinning');

    cols.forEach((col, reelIndex) => {
      const strip = col.querySelector('.slot-reel-strip');
      if (!strip) return;

      strip.innerHTML = buildStrip(finalIds[reelIndex]);
      strip.classList.remove('stopping');
      strip.classList.add('spinning');
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          strip.style.transition = '';
        });
      });

      const stopAt = 700 + reelIndex * 450;

      setTimeout(() => {
        strip.classList.remove('spinning');
        strip.classList.add('stopping');
        strip.style.transform = `translateY(-${(STRIP_LENGTH - 1) * SYMBOL_HEIGHT}px)`;

        col.classList.add('reel-landed');
        setTimeout(() => col.classList.remove('reel-landed'), 380);

        if (reelIndex === cols.length - 1) {
          setTimeout(onDone, 420);
        }
      }, stopAt);
    });
  }

  function setSpinEnabled(enabled) {
    ['neonSlotSpinBtn', 'neonSlotSpinBtnAlt', 'neonSlotFreeBtn'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
    document.querySelector('.slot-lever')?.classList.toggle('disabled', !enabled);
  }

  function celebrateWin(won) {
    setCabinetState(won ? 'is-win' : 'is-loss');
    if (!won) return;
    document.querySelectorAll('#neonSlotReels .slot-reel-col').forEach((col) => {
      const symbols = col.querySelectorAll('.slot-symbol');
      const visible = symbols[symbols.length - 1];
      if (visible) visible.classList.add('symbol-win');
    });
  }

  function clearWinHighlight() {
    document.querySelectorAll('.symbol-win').forEach((el) => el.classList.remove('symbol-win'));
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
    setSpinEnabled(false);
    clearWinHighlight();
    pullLever();

    const freeState = loadFreeDaily();
    let won = false;
    let payoutUsd = 0;

    if (free) {
      if (freeState.freeSpinsUsed >= FREE_SPINS_PER_DAY) {
        window.AppUI?.toast?.('No free spins left today', 'info');
        spinning = false;
        setSpinEnabled(true);
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
        setSpinEnabled(true);
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
    if (resultEl) {
      resultEl.textContent = 'Spinning…';
      resultEl.className = 'slot-result spinning-text';
    }

    animateReels(reels, () => {
      const sym = getSymbol(reels[0]);
      const msg = won
        ? `JACKPOT! ${sym.emoji} ${sym.label} ×3 — +$${payoutUsd.toFixed(2)}${free ? ' + free ticket' : ''}`
        : 'Try again — no match this spin';
      if (resultEl) {
        resultEl.textContent = msg;
        resultEl.className = `slot-result ${won ? 'win' : 'loss'}`;
      }
      const explainEl = document.getElementById('neonSlotExplain');
      if (explainEl) {
        explainEl.textContent = window.ProvablyFair?.explainOutcome?.(won, free ? 'slot_free' : 'slot_paid') || '';
      }
      celebrateWin(won);
      recordPlay(wallet, { betUsd: free ? 0 : betUsd, payoutUsd, won, free, reels });
      updateFreeUI();
      spinning = false;
      setSpinEnabled(true);
    });
  }

  function updateFreeUI() {
    const freeState = loadFreeDaily();
    const spinsLeft = Math.max(0, FREE_SPINS_PER_DAY - freeState.freeSpinsUsed);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('freeSpinsLeft', String(spinsLeft));
    set('freeTicketsLeft', String(Math.max(0, FREE_TICKETS_PER_DAY - freeState.freeTicketsUsed)));
  }

  function bindSpin() {
    const handler = () => {
      const bet = parseFloat(document.getElementById('neonSlotBet')?.value || '1');
      play({ free: false, betUsd: bet });
    };
    document.getElementById('neonSlotSpinBtn')?.addEventListener('click', handler);
    document.getElementById('neonSlotSpinBtnAlt')?.addEventListener('click', handler);
  }

  function init() {
    updateFreeUI();
    bindSpin();
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
      reelsWrap.innerHTML = buildReelsHTML(['cherry', 'star', 'crown']);
    }
    buildLights();
    startMarquee();
  }

  return { init, play, updateFreeUI };
})();

window.SlotMachine = SlotMachine;
