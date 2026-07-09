/**
 * NeonDraw Roulette — American wheel (0, 00, 1–36) · Vegas casino floor
 */
const Roulette = (() => {
  const STORAGE = 'roulette_history';
  const STORAGE_FREE = 'roulette_free_daily';
  const FREE_SPINS_PER_DAY = 3;
  const FREE_WIN_RATE = 0.12;
  const FREE_VIRTUAL_BET_USD = 1;
  const WHEEL_ORDER = [
    '0', '28', '9', '26', '30', '11', '7', '20', '32', '17', '5', '22', '34', '15', '3', '24', '36', '13', '1',
    '00', '27', '10', '25', '29', '12', '8', '19', '31', '18', '6', '21', '33', '16', '4', '23', '35', '14', '2',
  ];
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const DEG_PER = 360 / WHEEL_ORDER.length;

  const OUTSIDE_BETS = [
    { id: 'red', label: 'Red', payout: 1, color: '#e63946' },
    { id: 'black', label: 'Black', payout: 1, color: '#1a1a24' },
    { id: 'even', label: 'Even', payout: 1 },
    { id: 'odd', label: 'Odd', payout: 1 },
    { id: 'low', label: '1–18', payout: 1 },
    { id: 'high', label: '19–36', payout: 1 },
  ];

  let spinning = false;
  let selectedBet = 'red';
  let wheelRotation = 0;

  function slotColor(label) {
    if (label === '0' || label === '00') return 'green';
    const n = parseInt(label, 10);
    return RED.has(n) ? 'red' : 'black';
  }

  function parseSlot(label) {
    if (label === '00') return { label: '00', num: null };
    const num = parseInt(label, 10);
    return { label, num: Number.isNaN(num) ? null : num };
  }

  function checkWin(betType, resultLabel) {
    const { num } = parseSlot(resultLabel);
    if (num === null) return false;
    if (betType === 'red') return RED.has(num);
    if (betType === 'black') return num > 0 && !RED.has(num);
    if (betType === 'even') return num > 0 && num % 2 === 0;
    if (betType === 'odd') return num > 0 && num % 2 === 1;
    if (betType === 'low') return num >= 1 && num <= 18;
    if (betType === 'high') return num >= 19 && num <= 36;
    return false;
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadFreeDaily() {
    if (window.NeonDrawDev?.hasUnlimitedSpins?.()) {
      return {
        day: todayKey(),
        freeSpinsUsed: 0,
        freeWins: 0,
        freePlays: 0,
      };
    }
    try {
      const data = SecureStorage.getJSON(STORAGE_FREE, {});
      if (data.day !== todayKey()) {
        return { day: todayKey(), freeSpinsUsed: 0, freeWins: 0, freePlays: 0 };
      }
      return data;
    } catch {
      return { day: todayKey(), freeSpinsUsed: 0, freeWins: 0, freePlays: 0 };
    }
  }

  function saveFreeDaily(data) {
    SecureStorage.setJSON(STORAGE_FREE, { ...data, day: todayKey() });
  }

  function canFreeWin(freeState) {
    if (freeState.freePlays === 0) return Math.random() < FREE_WIN_RATE;
    const currentRate = freeState.freeWins / freeState.freePlays;
    if (currentRate >= FREE_WIN_RATE) return false;
    return Math.random() < FREE_WIN_RATE;
  }

  function pickResult() {
    return WHEEL_ORDER[Math.floor(Math.random() * WHEEL_ORDER.length)];
  }

  function pickResultForBet(betType, forceWin) {
    if (!forceWin) return pickResult();
    const winners = WHEEL_ORDER.filter((label) => checkWin(betType, label));
    if (!winners.length) return pickResult();
    return winners[Math.floor(Math.random() * winners.length)];
  }

  function buildWheelSVG() {
    const cx = 100;
    const cy = 100;
    const outerR = 96;
    const innerR = 58;
    const labelR = 78;
    const segments = WHEEL_ORDER.map((label, i) => {
      const start = (i / WHEEL_ORDER.length) * Math.PI * 2 - Math.PI / 2;
      const end = ((i + 1) / WHEEL_ORDER.length) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + outerR * Math.cos(start);
      const y1 = cy + outerR * Math.sin(start);
      const x2 = cx + outerR * Math.cos(end);
      const y2 = cy + outerR * Math.sin(end);
      const x3 = cx + innerR * Math.cos(end);
      const y3 = cy + innerR * Math.sin(end);
      const x4 = cx + innerR * Math.cos(start);
      const y4 = cy + innerR * Math.sin(start);
      const large = end - start > Math.PI ? 1 : 0;
      const color = slotColor(label);
      const fill = color === 'green' ? '#1fa84a' : color === 'red' ? '#d62839' : '#14141c';
      const mid = (start + end) / 2;
      const lx = cx + labelR * Math.cos(mid);
      const ly = cy + labelR * Math.sin(mid);
      const rot = ((mid * 180) / Math.PI) + 90;
      return `
        <path d="M ${cx} ${cy} L ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z"
          fill="${fill}" stroke="rgba(245,183,49,0.35)" stroke-width="0.6"/>
        <text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle"
          transform="rotate(${rot} ${lx} ${ly})"
          fill="#fff" font-size="${label.length > 1 ? '6.5' : '7.5'}" font-weight="700"
          font-family="DM Sans, system-ui, sans-serif">${label}</text>`;
    }).join('');

    return `<svg class="roulette-wheel-svg" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <radialGradient id="roulette-hub-g" cx="50%" cy="45%">
          <stop offset="0%" stop-color="#ffe566"/>
          <stop offset="55%" stop-color="#f5b731"/>
          <stop offset="100%" stop-color="#a87208"/>
        </radialGradient>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${outerR + 2}" fill="none" stroke="rgba(245,183,49,0.65)" stroke-width="3"/>
      ${segments}
      <circle cx="${cx}" cy="${cy}" r="22" fill="url(#roulette-hub-g)" stroke="#fff" stroke-width="2"/>
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
        fill="#1a0a00" font-size="8" font-weight="800" letter-spacing="0.08em">NEON</text>
    </svg>`;
  }

  function rotationForSlot(slotIndex) {
    const centerOffset = slotIndex * DEG_PER + DEG_PER / 2;
    const extra = (5 + Math.floor(Math.random() * 3)) * 360;
    return extra + (360 - centerOffset);
  }

  function setWheelRotation(deg, animate) {
    const wheel = document.getElementById('rouletteWheel');
    if (!wheel) return;
    wheelRotation = deg;
    wheel.style.transition = animate ? 'transform 4.2s cubic-bezier(0.15, 0.85, 0.22, 1)' : 'none';
    wheel.style.transform = `rotate(${deg}deg)`;
  }

  function setCabinetState(state) {
    const cab = document.getElementById('neonRouletteCabinet');
    if (!cab) return;
    cab.classList.remove('is-spinning', 'is-win', 'is-loss');
    if (state) cab.classList.add(state);
  }

  function recordPlay(wallet, { betUsd, payoutUsd, won, betType, result, free = false }) {
    const list = SecureStorage.getJSON(STORAGE, []);
    list.unshift({ wallet, betUsd, payoutUsd, won, betType, result, free, timestamp: Date.now() });
    SecureStorage.setJSON(STORAGE, list.slice(0, 500));
    window.dispatchEvent(new CustomEvent('roulette-played', {
      detail: { won, payoutUsd, betUsd, betType, result, wallet, free },
    }));
    if (won) {
      window.RouletteTicker?.addWin?.({ wallet, betType, result, betUsd, payoutUsd, won, free });
    }
    renderRecentResults();
  }

  function renderRecentResults() {
    const el = document.getElementById('rouletteRecentResults');
    if (!el) return;
    const list = SecureStorage.getJSON(STORAGE, []).slice(0, 12);
    if (!list.length) {
      el.innerHTML = '<span class="roulette-recent-empty">No spins yet</span>';
      return;
    }
    el.innerHTML = list.map((r) => {
      const c = slotColor(r.result);
      return `<span class="roulette-result-chip roulette-result-${c}" title="${r.result}">${r.result}</span>`;
    }).join('');
  }

  function updateBetUI() {
    document.querySelectorAll('.roulette-bet-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.bet === selectedBet);
    });
    const meta = OUTSIDE_BETS.find((b) => b.id === selectedBet);
    const hint = document.getElementById('rouletteBetHint');
    if (hint && meta) {
      hint.textContent = `${meta.label} pays ${meta.payout}:1 · 0 and 00 lose outside bets`;
    }
  }

  function bindBets() {
    document.querySelectorAll('.roulette-bet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (spinning) return;
        selectedBet = btn.dataset.bet || 'red';
        updateBetUI();
      });
    });
  }

  function getFreeSpinsLimit() {
    return window.NeonDrawDev?.hasUnlimitedSpins?.() ? 9999 : FREE_SPINS_PER_DAY;
  }

  function getBetUsd() {
    const raw = parseFloat(document.getElementById('neonRouletteBet')?.value || '');
    return Number.isFinite(raw) ? raw : null;
  }

  function canAffordPaidSpin() {
    const wallet = window.SecureWeb3?.getAddress?.();
    if (!wallet) return false;
    const betUsd = getBetUsd();
    if (betUsd == null) return false;
    const minBet = window.TicketPricing?.MIN_ROULETTE_BET_USD || 0.5;
    if (betUsd < minBet) return false;
    const betEth = betUsd / (window.PoolPolicy?.POLICY?.ETH_USD || 3500);
    const casinoBal = window.SecureWeb3?.getCasinoBalance?.(wallet) || 0;
    return betEth <= casinoBal;
  }

  function updatePlayControls() {
    const connected = window.SecureWeb3?.isConnected?.();
    const paidBtn = document.getElementById('neonRouletteSpinBtn');
    const canPaid = connected && canAffordPaidSpin() && !spinning;
    if (paidBtn) {
      paidBtn.disabled = !canPaid;
      paidBtn.title = canPaid
        ? ''
        : 'Deposit to your casino balance to spin for real money';
    }
    updateFreeUI();
  }

  async function spin({ free = false } = {}) {
    if (spinning) return;
    const wallet = window.SecureWeb3?.getAddress?.();
    if (!wallet) {
      window.AppUI?.toast?.('Connect wallet to play roulette', 'info');
      window.AppUI?.openWallet?.();
      return;
    }

    const freeState = loadFreeDaily();
    let betUsd = 0;
    let forceWin = false;

    if (free) {
      if (freeState.freeSpinsUsed >= getFreeSpinsLimit()) {
        window.AppUI?.toast?.('No free roulette spins left today', 'info');
        return;
      }
      betUsd = FREE_VIRTUAL_BET_USD;
      forceWin = canFreeWin(freeState);
    } else {
      betUsd = getBetUsd();
      const minBet = window.TicketPricing?.MIN_ROULETTE_BET_USD || 0.5;
      if (betUsd == null || betUsd < minBet) {
        window.AppUI?.toast?.(`Minimum bet is $${minBet}`, 'info');
        return;
      }
      if (!canAffordPaidSpin()) {
        window.AppUI?.toast?.(
          `Deposit at least ${window.TicketPricing?.formatUsd?.(window.TicketPricing?.MIN_DEPOSIT_USD || 10) || '$10'} to casino balance first`,
          'error'
        );
        updatePlayControls();
        return;
      }
    }

    spinning = true;
    setSpinEnabled(false);
    setCabinetState('is-spinning');

    try {
      if (free) {
        freeState.freeSpinsUsed += 1;
        freeState.freePlays += 1;
        saveFreeDaily(freeState);
      } else {
        const casinoBal = window.SecureWeb3?.getCasinoBalance?.(wallet) || 0;
        const betEth = betUsd / (window.PoolPolicy?.POLICY?.ETH_USD || 3500);
        window.SecureWeb3?.setCasinoBalance?.(wallet, casinoBal - betEth);
      }

      const result = pickResultForBet(selectedBet, forceWin);
    const slotIndex = WHEEL_ORDER.indexOf(result);
    const targetRot = wheelRotation + rotationForSlot(slotIndex);

    const resultEl = document.getElementById('rouletteResult');
    const explainEl = document.getElementById('rouletteExplain');
    if (resultEl) {
      resultEl.textContent = free ? 'Free spin…' : 'Spinning…';
      resultEl.className = 'roulette-result spinning-text';
    }
    if (explainEl) explainEl.textContent = '';

    setWheelRotation(targetRot, true);

    await new Promise((r) => setTimeout(r, 4300));

    const won = checkWin(selectedBet, result);
    let payoutUsd = 0;
    const meta = OUTSIDE_BETS.find((b) => b.id === selectedBet);
    if (won) {
      if (free) {
        freeState.freeWins += 1;
        saveFreeDaily(freeState);
        payoutUsd = 0.5 + Math.random() * 2;
        const creditEth = payoutUsd / (window.PoolPolicy?.POLICY?.ETH_USD || 3500);
        window.PoolPolicy?.processDrawPayout?.(payoutUsd, wallet, { source: 'roulette_free' });
        window.SecureWeb3?.setCasinoBalance?.(
          wallet,
          (window.SecureWeb3?.getCasinoBalance?.(wallet) || 0) + creditEth
        );
      } else {
        payoutUsd = betUsd * (1 + (meta?.payout || 1));
        const creditEth = payoutUsd / (window.PoolPolicy?.POLICY?.ETH_USD || 3500);
        window.PoolPolicy?.processDrawPayout?.(payoutUsd, wallet, { source: 'roulette' });
        window.SecureWeb3?.setCasinoBalance?.(
          wallet,
          (window.SecureWeb3?.getCasinoBalance?.(wallet) || 0) + creditEth
        );
      }
    }

    const betLabel = meta?.label || selectedBet;
    const colorClass = slotColor(result);
    if (resultEl) {
      resultEl.innerHTML = won
        ? `WIN! <span class="roulette-result-num roulette-result-${colorClass}">${result}</span> · ${betLabel} · +$${payoutUsd.toFixed(2)}${free ? ' (free spin)' : ''}`
        : `<span class="roulette-result-num roulette-result-${colorClass}">${result}</span> · ${betLabel} — no win${free ? ' (free spin)' : ''}`;
      resultEl.className = `roulette-result ${won ? 'win' : 'loss'}`;
    }
    if (explainEl) {
      explainEl.textContent = window.ProvablyFair?.explainOutcome?.(won, free ? 'roulette_free' : 'roulette') || '';
    }

    setCabinetState(won ? 'is-win' : 'is-loss');
    if (won) window.PoolPolicy?.notifyWinOnTheWay?.(wallet);
    recordPlay(wallet, { betUsd: free ? 0 : betUsd, payoutUsd, won, betType: selectedBet, result, free });
    } finally {
      spinning = false;
      setSpinEnabled(true);
      updatePlayControls();
      window.AppUI?.refreshBalances?.();
    }
  }

  function setSpinEnabled(enabled) {
    const btn = document.getElementById('neonRouletteSpinBtn');
    const freeBtn = document.getElementById('neonRouletteFreeBtn');
    const freeState = loadFreeDaily();
    const spinsLeft = Math.max(0, getFreeSpinsLimit() - freeState.freeSpinsUsed);
    if (freeBtn) freeBtn.disabled = !enabled || spinsLeft <= 0;
    document.querySelectorAll('.roulette-bet-btn').forEach((b) => { b.disabled = !enabled; });
    if (!enabled) {
      if (btn) btn.disabled = true;
      return;
    }
    updatePlayControls();
  }

  function updateFreeUI() {
    const freeState = loadFreeDaily();
    const limit = getFreeSpinsLimit();
    const spinsLeft = Math.max(0, limit - freeState.freeSpinsUsed);
    const countEl = document.getElementById('freeRouletteSpinsLeft');
    const freeBtn = document.getElementById('neonRouletteFreeBtn');
    if (countEl) {
      countEl.textContent = window.NeonDrawDev?.hasUnlimitedSpins?.()
        ? '∞'
        : String(spinsLeft);
    }
    if (freeBtn) {
      freeBtn.disabled = spinsLeft <= 0;
      freeBtn.textContent = spinsLeft > 0 ? 'Use Free Spin' : 'No spins left today';
    }
  }

  function init() {
    const wheel = document.getElementById('rouletteWheel');
    if (wheel) wheel.innerHTML = buildWheelSVG();

    bindBets();
    updateBetUI();
    updateFreeUI();
    updatePlayControls();
    renderRecentResults();

    document.getElementById('neonRouletteSpinBtn')?.addEventListener('click', () => spin({ free: false }));
    document.getElementById('neonRouletteFreeBtn')?.addEventListener('click', () => spin({ free: true }));
    document.getElementById('neonRouletteBet')?.addEventListener('input', () => updatePlayControls());

    window.SecureWeb3?.on?.((event) => {
      if (['connected', 'disconnected', 'deposit-success', 'withdraw-success'].includes(event)) {
        updatePlayControls();
      }
    });

    window.addEventListener('roulette-played', renderRecentResults);
  }

  return { init, spin, updateFreeUI, updatePlayControls, WHEEL_ORDER, slotColor, checkWin };
})();

window.Roulette = Roulette;
