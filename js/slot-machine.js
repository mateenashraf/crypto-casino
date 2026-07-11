/**
 * NeonDraw Slots: colorful Vegas-style cabinet with animated reels
 */
const SlotMachine = (() => {
  const STORAGE = 'slot_history';
  const STORAGE_FREE = 'slot_free_daily';
  const PAID_WIN_RATE = 0.25;
  const FREE_WIN_RATE = 0.10;
  const FREE_SPINS_PER_DAY = 3;
  const FREE_TICKETS_PER_DAY = 2;
  const STRIP_LENGTH = 30;

  function getSymbolHeight() {
    const cabinet = document.getElementById('neonSlotCabinet');
    if (!cabinet) return 92;
    const raw = getComputedStyle(cabinet).getPropertyValue('--slot-symbol-h').trim();
    const px = parseFloat(raw);
    return px > 0 ? px : 92;
  }

  function stripOffset() {
    return (STRIP_LENGTH - 1) * getSymbolHeight();
  }

  const SYMBOLS = window.SlotSymbols?.getCatalog?.() || [
    { id: 'cherry', label: 'Cherry', color: '#ff4d6d', bg: 'linear-gradient(160deg, #4a1028 0%, #1a0810 100%)' },
    { id: 'orange', label: 'Orange', color: '#ff9f43', bg: 'linear-gradient(160deg, #3d2810 0%, #1a1208 100%)' },
    { id: 'bell', label: 'Bell', color: '#f5b731', bg: 'linear-gradient(160deg, #3d3010 0%, #1a1608 100%)' },
    { id: 'crown', label: 'Crown', color: '#ffc940', bg: 'linear-gradient(160deg, #3d3010 0%, #1a1408 100%)' },
    { id: 'seven', label: 'Lucky 7', color: '#ff3344', bg: 'linear-gradient(160deg, #3d1018 0%, #140810 100%)' },
  ];

  const PAYOUT_MULT = { cherry: 2, orange: 3, bell: 5, crown: 15, seven: 25 };

  let spinning = false;
  let marqueeTimer = null;

  function getSymbol(id) {
    return SYMBOLS.find((s) => s.id === id) || SYMBOLS[0];
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadFreeDaily() {
    if (window.NeonDrawDev?.hasUnlimitedSpins?.()) {
      return {
        day: todayKey(),
        freeSpinsUsed: 0,
        freeTicketsUsed: 0,
        freeWins: 0,
        freePlays: 0,
      };
    }
    try {
      const data = SecureStorage.getJSON(STORAGE_FREE, {});
      if (data.day !== todayKey()) {
        return { day: todayKey(), freeSpinsUsed: 0, freeTicketsUsed: 0, freeWins: 0, freePlays: 0 };
      }
      return data;
    } catch {
      return { day: todayKey(), freeSpinsUsed: 0, freeTicketsUsed: 0, freeWins: 0, freePlays: 0 };
    }
  }

  function saveFreeDaily(data) {
    SecureStorage.setJSON(STORAGE_FREE, { ...data, day: todayKey() });
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
    const list = SecureStorage.getJSON(STORAGE, []);
    list.unshift({ wallet, betUsd, payoutUsd, won, free, reels, timestamp: Date.now() });
    SecureStorage.setJSON(STORAGE, list.slice(0, 500));
    window.dispatchEvent(new CustomEvent('slot-played', { detail: { won, payoutUsd, betUsd, free, reels, wallet } }));
    if (won) {
      window.SlotTicker?.addWin?.({ wallet, reels, betUsd, payoutUsd, won, free });
    }
  }

  function renderSymbolCell(sym) {
    const art = window.SlotSymbols?.render?.(sym.id)
      || `<span class="slot-art">${sym.emoji || '?'}</span>`;
    return `
      <div class="slot-symbol" data-symbol="${sym.id}" style="--sym-color:${sym.color};--sym-bg:${sym.bg}">
        ${art}
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

  function buildReelsHTML(finals = ['cherry', 'orange', 'seven']) {
    return finals.map((sym, i) => `
      <div class="slot-reel-col" data-reel="${i}">
        <div class="slot-reel-viewport">
          <div class="slot-reel-strip" style="transform: translateY(-${stripOffset()}px)">
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

  function pullLever(animate = true) {
    const lever = document.querySelector('.slot-lever');
    if (!lever) return;
    if (animate) {
      lever.classList.add('pulled');
      setLeverPull(1, false);
      setTimeout(() => {
        lever.classList.remove('pulled');
        setLeverPull(0, true);
      }, 520);
    }
  }

  function setLeverPull(ratio, transition = true) {
    const lever = document.querySelector('.slot-lever');
    if (!lever) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    lever.style.setProperty('--lever-pull', String(clamped));
    lever.classList.toggle('is-dragging', clamped > 0 && !transition);
    if (transition) {
      lever.classList.add('lever-spring');
      lever.addEventListener('transitionend', () => lever.classList.remove('lever-spring'), { once: true });
    }
  }

  function bindLeverDrag() {
    const lever = document.getElementById('neonSlotSpinBtn');
    const mount = document.querySelector('.slot-lever-mount');
    if (!lever || !mount) return;

    const PULL_THRESHOLD = 0.55;
    const MAX_PULL_PX = 56;
    let dragging = false;
    let triggered = false;

    const getPivotY = () => {
      const base = mount.querySelector('.slot-lever-base');
      if (base) return base.getBoundingClientRect().top + 2;
      return mount.getBoundingClientRect().top + 20;
    };

    const getPullFromEvent = (clientY) => {
      const pivotY = getPivotY();
      return Math.max(0, Math.min(1, (clientY - pivotY) / MAX_PULL_PX));
    };

    const finishDrag = (shouldSpin) => {
      if (!dragging) return;
      dragging = false;
      lever.classList.remove('is-dragging');
      const bet = parseFloat(document.getElementById('neonSlotBet')?.value || '1');
      if (shouldSpin && !triggered && !spinning && canAffordPaidSpin(bet)) {
        triggered = true;
        play({ free: false, betUsd: bet });
      }
      setLeverPull(0, true);
      setTimeout(() => { triggered = false; }, 300);
    };

    lever.addEventListener('pointerdown', (e) => {
      if (spinning || lever.disabled || lever.classList.contains('disabled')) return;
      dragging = true;
      triggered = false;
      lever.setPointerCapture(e.pointerId);
      lever.classList.add('is-dragging');
      e.preventDefault();
    });

    lever.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      setLeverPull(getPullFromEvent(e.clientY), false);
    });

    lever.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      const pull = getPullFromEvent(e.clientY);
      finishDrag(pull >= PULL_THRESHOLD);
      lever.releasePointerCapture(e.pointerId);
    });

    lever.addEventListener('pointercancel', () => finishDrag(false));

    lever.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const bet = parseFloat(document.getElementById('neonSlotBet')?.value || '1');
        if (!spinning && !lever.disabled && canAffordPaidSpin(bet)) {
          play({ free: false, betUsd: bet });
        }
      }
    });
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
        strip.style.transform = `translateY(-${stripOffset()}px)`;

        col.classList.add('reel-landed');
        setTimeout(() => col.classList.remove('reel-landed'), 380);

        if (reelIndex === cols.length - 1) {
          setTimeout(onDone, 420);
        }
      }, stopAt);
    });
  }

  function getFreeSpinsLimit() {
    return window.NeonDrawDev?.hasUnlimitedSpins?.() ? 9999 : FREE_SPINS_PER_DAY;
  }

  function getBetUsd() {
    const raw = parseFloat(document.getElementById('neonSlotBet')?.value || '');
    return Number.isFinite(raw) ? raw : null;
  }

  function canAffordPaidSpin(betUsd) {
    const wallet = window.SecureWeb3?.getAddress?.();
    if (!wallet) return false;
    const amount = betUsd ?? getBetUsd();
    if (amount == null) return false;
    const minBet = window.TicketPricing?.MIN_SLOT_BET_USD || 1;
    if (amount < minBet) return false;
    const betEth = amount / (window.PoolPolicy?.POLICY?.ETH_USD || 3500);
    const casinoBal = window.SecureWeb3?.getCasinoBalance?.(wallet) || 0;
    return betEth <= casinoBal;
  }

  function updatePlayControls() {
    const connected = window.SecureWeb3?.isConnected?.();
    const canPaid = connected && canAffordPaidSpin() && !spinning;
    const lever = document.querySelector('.slot-lever');
    const altBtn = document.getElementById('neonSlotSpinBtnAlt');
    if (lever) {
      lever.disabled = !canPaid;
      lever.classList.toggle('disabled', !canPaid);
    }
    if (altBtn) altBtn.disabled = !canPaid;
    updateFreeUI();
  }

  function setSpinEnabled(enabled) {
    ['neonSlotFreeBtn'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
    const lever = document.querySelector('.slot-lever');
    const altBtn = document.getElementById('neonSlotSpinBtnAlt');
    if (!enabled) {
      if (lever) {
        lever.disabled = true;
        lever.classList.add('disabled');
      }
      if (altBtn) altBtn.disabled = true;
      return;
    }
    updatePlayControls();
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

    const freeState = loadFreeDaily();
    let won = false;
    let payoutUsd = 0;
    let resolvedBetUsd = betUsd;

    if (free) {
      const dailyLeft = Math.max(0, getFreeSpinsLimit() - freeState.freeSpinsUsed);
      const bonusLeft = window.Referrals?.getBonus?.(wallet)?.slots || 0;
      if (dailyLeft <= 0 && bonusLeft <= 0) {
        window.AppUI?.toast?.('No free spins left today', 'info');
        return;
      }
    } else {
      resolvedBetUsd = getBetUsd() ?? betUsd;
      const minBet = window.TicketPricing?.MIN_SLOT_BET_USD || 1;
      if (!Number.isFinite(resolvedBetUsd) || resolvedBetUsd < minBet) {
        window.AppUI?.toast?.(`Minimum bet is $${minBet}`, 'info');
        return;
      }
      if (!canAffordPaidSpin(resolvedBetUsd)) {
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
    clearWinHighlight();
    pullLever();

    if (free) {
      const dailyLeft = Math.max(0, getFreeSpinsLimit() - freeState.freeSpinsUsed);
      if (dailyLeft > 0) {
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
        window.Referrals?.consumeBonusSpin?.(wallet, 'slots');
        won = Math.random() < FREE_WIN_RATE;
        if (won) {
          payoutUsd = 0.5 + Math.random() * 4;
          window.SecureWeb3?.grantFreeTickets?.(wallet, 1, { source: 'referral_spin' });
        }
      }
    } else {
      const casinoBal = window.SecureWeb3?.getCasinoBalance?.(wallet) || 0;
      const betEth = resolvedBetUsd / (window.PoolPolicy?.POLICY?.ETH_USD || 3500);
      if (resolvedBetUsd > 0) {
        window.SecureWeb3?.setCasinoBalance?.(wallet, casinoBal - betEth);
      }
      won = Math.random() < PAID_WIN_RATE;
      if (won) {
        const sym = pickSymbol();
        const mult = PAYOUT_MULT[sym] || 3;
        payoutUsd = resolvedBetUsd * mult * 0.4;
        const creditEth = payoutUsd / (window.PoolPolicy?.POLICY?.ETH_USD || 3500);
        window.PoolPolicy?.processDrawPayout?.(payoutUsd, wallet, { source: 'slot' });
        window.SecureWeb3?.setCasinoBalance?.(wallet, (window.SecureWeb3?.getCasinoBalance?.(wallet) || 0) + creditEth);
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
      const symLabel = sym.label || sym.id;
      const msg = won
        ? `JACKPOT! ${symLabel} ×3 · +$${payoutUsd.toFixed(2)}${free ? ' + free ticket' : ''}`
        : 'Try again. No match this spin';
      if (resultEl) {
        resultEl.textContent = msg;
        resultEl.className = `slot-result ${won ? 'win' : 'loss'}`;
      }
      const explainEl = document.getElementById('neonSlotExplain');
      if (explainEl) {
        explainEl.textContent = window.ProvablyFair?.explainOutcome?.(won, free ? 'slot_free' : 'slot_paid') || '';
      }
      celebrateWin(won);
      if (won) window.PoolPolicy?.notifyWinOnTheWay?.(wallet);
      recordPlay(wallet, { betUsd: free ? 0 : resolvedBetUsd, payoutUsd, won, free, reels });
      updateFreeUI();
      spinning = false;
      setSpinEnabled(true);
      updatePlayControls();
      window.AppUI?.refreshBalances?.();
    });
  }

  function updateFreeUI() {
    const freeState = loadFreeDaily();
    const limit = getFreeSpinsLimit();
    const wallet = window.SecureWeb3?.getAddress?.();
    const bonus = wallet ? (window.Referrals?.getBonus?.(wallet)?.slots || 0) : 0;
    const spinsLeft = Math.max(0, limit - freeState.freeSpinsUsed) + bonus;
    const claimsLeft = Math.max(0, FREE_TICKETS_PER_DAY - freeState.freeTicketsUsed);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('freeSpinsLeft', window.NeonDrawDev?.hasUnlimitedSpins?.() ? '∞' : String(spinsLeft));
    set('freeTicketsLeft', String(claimsLeft));

    const freeBtn = document.getElementById('neonSlotFreeBtn');
    const claimBtn = document.getElementById('neonSlotGrantFreeTicket');
    if (freeBtn) {
      freeBtn.disabled = spinsLeft <= 0;
      freeBtn.textContent = spinsLeft > 0 ? 'Use Free Spin' : 'No spins left today';
    }
    if (claimBtn) {
      claimBtn.disabled = claimsLeft <= 0;
      claimBtn.textContent = claimsLeft > 0 ? 'Claim Free Ticket' : 'All claimed today';
    }

    const balance = wallet ? (window.SecureWeb3?.getFreeTicketBalance?.(wallet) || 0) : 0;
    set('slotWalletFreeTickets', String(balance));
    const walletRow = document.getElementById('slotBonusWalletRow');
    if (walletRow) walletRow.hidden = !wallet || balance < 1;
  }

  const PENDING_FREE_TICKET_KEY = '_nd8_pft';

  function claimDailyFreeTicket() {
    const wallet = window.SecureWeb3?.getAddress?.();
    if (!wallet) {
      sessionStorage.setItem(PENDING_FREE_TICKET_KEY, '1');
      window.AppUI?.openWallet?.();
      window.AppUI?.toast?.('Connect wallet to claim your free ticket', 'info');
      return false;
    }
    const freeState = loadFreeDaily();
    if (freeState.freeTicketsUsed >= FREE_TICKETS_PER_DAY) {
      window.AppUI?.toast?.('Daily free tickets claimed. Come back tomorrow', 'info');
      return false;
    }
    freeState.freeTicketsUsed += 1;
    saveFreeDaily(freeState);
    window.SecureWeb3?.grantFreeTickets?.(wallet, 1, { source: 'daily_bonus' });
    window.AppUI?.toast?.('Free ticket added! Redeem it in the lottery section.', 'success');
    updateFreeUI();
    window.LotteryApp?.updateFreeTicketUI?.();
    return true;
  }

  function processPendingFreeTicketClaim() {
    if (sessionStorage.getItem(PENDING_FREE_TICKET_KEY) !== '1') return false;
    if (!window.SecureWeb3?.getAddress?.()) return false;
    sessionStorage.removeItem(PENDING_FREE_TICKET_KEY);
    return claimDailyFreeTicket();
  }

  function bindSpin() {
    const handler = () => {
      const bet = parseFloat(document.getElementById('neonSlotBet')?.value || '1');
      play({ free: false, betUsd: bet });
    };
    document.getElementById('neonSlotSpinBtnAlt')?.addEventListener('click', handler);
  }

  function refreshReelLayout() {
    document.querySelectorAll('#neonSlotReels .slot-reel-strip').forEach((strip) => {
      if (strip.classList.contains('spinning')) return;
      strip.style.transform = `translateY(-${stripOffset()}px)`;
    });
  }

  function init() {
    const reelsWrap = document.getElementById('neonSlotReels');
    if (reelsWrap) {
      reelsWrap.innerHTML = buildReelsHTML(['cherry', 'orange', 'seven']);
    }
    window.addEventListener('resize', () => {
      if (!spinning) refreshReelLayout();
    }, { passive: true });
    buildLights();
    renderPaytable();

    updateFreeUI();
    updatePlayControls();
    bindSpin();
    bindLeverDrag();
    renderPaytable();
    document.getElementById('neonSlotBet')?.addEventListener('input', () => updatePlayControls());
    window.SecureWeb3?.on?.((event) => {
      if (['connected', 'disconnected', 'free-ticket-granted', 'free-ticket-redeemed', 'deposit-success', 'withdraw-success'].includes(event)) {
        updateFreeUI();
        updatePlayControls();
      }
    });
    document.getElementById('neonSlotFreeBtn')?.addEventListener('click', () => play({ free: true }));
    document.getElementById('neonSlotGrantFreeTicket')?.addEventListener('click', () => {
      claimDailyFreeTicket();
    });

    startMarquee();
  }

  function renderPaytable() {
    const el = document.getElementById('slotPaytable') || document.querySelector('.slot-paytable');
    if (el && window.SlotSymbols?.paytableHtml) {
      el.innerHTML = window.SlotSymbols.paytableHtml();
    }
  }

  return { init, play, updateFreeUI, updatePlayControls, processPendingFreeTicketClaim, claimDailyFreeTicket };
})();

window.SlotMachine = SlotMachine;
