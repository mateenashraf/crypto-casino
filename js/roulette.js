/**
 * NeonDraw Roulette — American wheel (0, 00, 1–36) · Vegas casino floor
 */
const Roulette = (() => {
  const STORAGE = 'starbitz_roulette_history';
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

  function pickResult() {
    return WHEEL_ORDER[Math.floor(Math.random() * WHEEL_ORDER.length)];
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

  function recordPlay(wallet, { betUsd, payoutUsd, won, betType, result }) {
    const list = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    list.unshift({ wallet, betUsd, payoutUsd, won, betType, result, timestamp: Date.now() });
    localStorage.setItem(STORAGE, JSON.stringify(list.slice(0, 500)));
    window.dispatchEvent(new CustomEvent('roulette-played', {
      detail: { won, payoutUsd, betUsd, betType, result, wallet },
    }));
    if (won) {
      window.RouletteTicker?.addWin?.({ wallet, betType, result, betUsd, payoutUsd, won });
    }
    renderRecentResults();
  }

  function renderRecentResults() {
    const el = document.getElementById('rouletteRecentResults');
    if (!el) return;
    const list = JSON.parse(localStorage.getItem(STORAGE) || '[]').slice(0, 12);
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

  async function spin() {
    if (spinning) return;
    const wallet = window.SecureWeb3?.getAddress?.();
    if (!wallet) {
      window.AppUI?.toast?.('Connect wallet to play roulette', 'info');
      window.AppUI?.openWallet?.();
      return;
    }

    const betUsd = parseFloat(document.getElementById('neonRouletteBet')?.value || '1');
    if (betUsd < 0.5) {
      window.AppUI?.toast?.('Minimum bet is $0.50', 'info');
      return;
    }

    const casinoBal = window.SecureWeb3?.getCasinoBalance?.(wallet) || 0;
    const betEth = betUsd / (window.PoolPolicy?.POLICY?.ETH_USD || 3500);
    if (betEth > casinoBal) {
      window.AppUI?.toast?.('Deposit to casino balance first', 'error');
      return;
    }

    spinning = true;
    setSpinEnabled(false);
    setCabinetState('is-spinning');

    window.SecureWeb3?.setCasinoBalance?.(wallet, casinoBal - betEth);

    const result = pickResult();
    const slotIndex = WHEEL_ORDER.indexOf(result);
    const targetRot = wheelRotation + rotationForSlot(slotIndex);

    const resultEl = document.getElementById('rouletteResult');
    const explainEl = document.getElementById('rouletteExplain');
    if (resultEl) {
      resultEl.textContent = 'Spinning…';
      resultEl.className = 'roulette-result spinning-text';
    }
    if (explainEl) explainEl.textContent = '';

    setWheelRotation(targetRot, true);

    await new Promise((r) => setTimeout(r, 4300));

    const won = checkWin(selectedBet, result);
    let payoutUsd = 0;
    const meta = OUTSIDE_BETS.find((b) => b.id === selectedBet);
    if (won) {
      payoutUsd = betUsd * (1 + (meta?.payout || 1));
      const creditEth = payoutUsd / (window.PoolPolicy?.POLICY?.ETH_USD || 3500);
      const approval = window.PoolPolicy?.processDrawPayout?.(payoutUsd, wallet, { source: 'roulette' });
      if (approval?.auto) {
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
        ? `WIN! <span class="roulette-result-num roulette-result-${colorClass}">${result}</span> · ${betLabel} · +$${payoutUsd.toFixed(2)}`
        : `<span class="roulette-result-num roulette-result-${colorClass}">${result}</span> · ${betLabel} — no win`;
      resultEl.className = `roulette-result ${won ? 'win' : 'loss'}`;
    }
    if (explainEl) {
      explainEl.textContent = window.ProvablyFair?.explainOutcome?.(won, 'roulette') || '';
    }

    setCabinetState(won ? 'is-win' : 'is-loss');
    recordPlay(wallet, { betUsd, payoutUsd, won, betType: selectedBet, result });
    spinning = false;
    setSpinEnabled(true);
  }

  function setSpinEnabled(enabled) {
    const btn = document.getElementById('neonRouletteSpinBtn');
    if (btn) btn.disabled = !enabled;
    document.querySelectorAll('.roulette-bet-btn').forEach((b) => { b.disabled = !enabled; });
  }

  function init() {
    const wheel = document.getElementById('rouletteWheel');
    if (wheel) wheel.innerHTML = buildWheelSVG();

    bindBets();
    updateBetUI();
    renderRecentResults();

    document.getElementById('neonRouletteSpinBtn')?.addEventListener('click', spin);

    window.addEventListener('roulette-played', renderRecentResults);
  }

  return { init, spin, WHEEL_ORDER, slotColor, checkWin };
})();

window.Roulette = Roulette;
