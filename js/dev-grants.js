/**
 * Local dev only — test grants for lottery, slots, and roulette on localhost.
 */
(function () {
  const host = location.hostname;
  const isDevHost = host === 'localhost' || host === '127.0.0.1';
  if (!isDevHost) return;

  const UNLIMITED_KEY = 'dev_unlimited';
  const SLOT_FREE_KEY = 'slot_free_daily';
  const ROULETTE_FREE_KEY = 'roulette_free_daily';
  const PENDING_KEY = 'dev_ticket_grant';

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function hasUnlimitedSpins() {
    return SecureStorage.getRaw(UNLIMITED_KEY) === '1';
  }

  function setUnlimitedSpins(on) {
    SecureStorage.setRaw(UNLIMITED_KEY, on ? '1' : '0');
    resetCasinoFreeSpins();
    window.SlotMachine?.updateFreeUI?.();
    window.SlotMachine?.updatePlayControls?.();
    window.Roulette?.updateFreeUI?.();
    window.Roulette?.updatePlayControls?.();
    window.AppUI?.toast?.(on ? 'Dev: unlimited slot & roulette free spins ON' : 'Dev: unlimited free spins OFF', 'info');
  }

  function resetCasinoFreeSpins() {
    const day = todayKey();
    SecureStorage.setJSON(SLOT_FREE_KEY, {
      day,
      freeSpinsUsed: 0,
      freeTicketsUsed: 0,
      freeWins: 0,
      freePlays: 0,
    });
    SecureStorage.setJSON(ROULETTE_FREE_KEY, {
      day,
      freeSpinsUsed: 0,
      freeWins: 0,
      freePlays: 0,
    });
  }

  function applyPendingGrant() {
    const pending = parseInt(sessionStorage.getItem(PENDING_KEY) || '0', 10);
    if (pending < 1) return 0;
    const addr = window.SecureWeb3?.getAddress?.();
    if (!addr) return 0;
    sessionStorage.removeItem(PENDING_KEY);
    const balance = window.SecureWeb3.grantFreeTickets(addr, pending, { source: 'dev_grant' });
    window.LotteryApp?.updateFreeTicketUI?.();
    window.SlotMachine?.updateFreeUI?.();
    window.AppUI?.toast?.(`${pending} test free ticket(s) added`, 'success');
    return balance;
  }

  function queueGrant(qty = 5) {
    const n = Math.max(1, Math.min(20, Math.floor(qty)));
    sessionStorage.setItem(PENDING_KEY, String(n));
    const addr = window.SecureWeb3?.getAddress?.();
    if (addr) return applyPendingGrant();
    window.AppUI?.openWallet?.();
    window.AppUI?.toast?.(`Connect wallet to receive ${n} test free tickets`, 'info');
    return null;
  }

  function grantDevCasinoBalance(usd = 100) {
    const addr = window.SecureWeb3?.getAddress?.();
    if (!addr) {
      window.AppUI?.openWallet?.();
      window.AppUI?.toast?.('Connect wallet for dev casino balance', 'info');
      return;
    }
    const ethUsd = window.PoolPolicy?.POLICY?.ETH_USD || 3500;
    const creditEth = usd / ethUsd;
    const current = window.SecureWeb3.getCasinoBalance(addr);
    window.SecureWeb3.setCasinoBalance(addr, current + creditEth);
    window.AppUI?.refreshBalances?.();
    window.SlotMachine?.updatePlayControls?.();
    window.Roulette?.updatePlayControls?.();
    window.AppUI?.toast?.(`Dev: +$${usd} casino balance for testing`, 'success');
  }

  window.NeonDrawDev = {
    isDevHost,
    hasUnlimitedSpins,
    setUnlimitedSpins,
    resetCasinoFreeSpins,
    grantFreeTickets: queueGrant,
    applyPendingGrant,
    grantDevCasinoBalance,
  };

  if (SecureStorage.getRaw(UNLIMITED_KEY) == null) {
    SecureStorage.setRaw(UNLIMITED_KEY, '1');
  }

  window.SecureWeb3?.on?.((event) => {
    if (event === 'connected') {
      applyPendingGrant();
      window.SlotMachine?.updatePlayControls?.();
      window.Roulette?.updatePlayControls?.();
    }
  });

  const panel = document.createElement('div');
  panel.className = 'dev-grant-panel';
  panel.innerHTML = `
    <span class="dev-grant-label">Dev tools</span>
    <button type="button" class="dev-grant-btn" data-dev="tickets">+5 lottery tickets</button>
    <button type="button" class="dev-grant-btn" data-dev="balance">+$100 casino</button>
    <button type="button" class="dev-grant-btn" data-dev="reset-spins">Reset free spins</button>
    <button type="button" class="dev-grant-btn" data-dev="toggle-unlimited">Unlimited spins: on</button>
  `;
  document.body.appendChild(panel);

  const unlimitedBtn = panel.querySelector('[data-dev="toggle-unlimited"]');

  function syncUnlimitedBtn() {
    if (unlimitedBtn) {
      unlimitedBtn.textContent = `Unlimited spins: ${hasUnlimitedSpins() ? 'on' : 'off'}`;
    }
  }

  panel.querySelectorAll('.dev-grant-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      switch (btn.dataset.dev) {
        case 'tickets':
          queueGrant(5);
          break;
        case 'balance':
          grantDevCasinoBalance(100);
          break;
        case 'reset-spins':
          resetCasinoFreeSpins();
          window.SlotMachine?.updateFreeUI?.();
          window.Roulette?.updateFreeUI?.();
          window.AppUI?.toast?.('Dev: slot & roulette free spins reset', 'success');
          break;
        case 'toggle-unlimited':
          setUnlimitedSpins(!hasUnlimitedSpins());
          syncUnlimitedBtn();
          break;
        default:
          break;
      }
    });
  });

  syncUnlimitedBtn();
  window.SlotMachine?.updateFreeUI?.();
  window.Roulette?.updateFreeUI?.();
  window.SlotMachine?.updatePlayControls?.();
  window.Roulette?.updatePlayControls?.();
})();
