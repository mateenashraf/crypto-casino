/**
 * StarBitz — lottery app UI
 */
(function () {
  const wallet = window.SecureWeb3;
  const walletModal = document.getElementById('walletModal');
  const toastContainer = document.getElementById('toastContainer');

  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  function openModal(modal) {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  window.AppUI = {
    toast,
    openWallet: () => openModal(walletModal),
    closeWallet: () => closeModal(walletModal),
  };

  function updateWalletUI() {
    const connected = wallet.isConnected();
    const addr = wallet.getAddress();
    const btnText = document.getElementById('walletBtnText');
    const sidebarBal = document.getElementById('sidebarBalance');
    const ticketCountEl = document.getElementById('sidebarTicketCount');
    const myTickets = wallet.getAllTickets().filter(
      (t) => t.wallet?.toLowerCase() === addr?.toLowerCase()
    ).length;

    if (connected) {
      btnText.textContent = wallet.shortenAddress(addr);
      sidebarBal.hidden = false;
      if (ticketCountEl) ticketCountEl.textContent = String(myTickets);
      walletAddr.hidden = false;
      walletAddr.textContent = addr;
      disconnectBtn.hidden = false;

      document.getElementById('connectPrompt').hidden = true;
      document.getElementById('depositForm').hidden = false;
      document.getElementById('withdrawConnectPrompt').hidden = true;
      document.getElementById('withdrawForm').hidden = false;

      refreshBalances();
      renderTxHistory();
    } else {
      btnText.textContent = 'Connect Wallet';
      sidebarBal.hidden = true;
      walletAddr.hidden = true;
      disconnectBtn.hidden = true;

      document.getElementById('connectPrompt').hidden = false;
      document.getElementById('depositForm').hidden = true;
      document.getElementById('withdrawConnectPrompt').hidden = false;
      document.getElementById('withdrawForm').hidden = true;
    }

  }

  async function refreshBalances() {
    if (!wallet.isConnected()) return;
    const addr = wallet.getAddress();
    try {
      const walletBal = await wallet.getWalletBalance();
      const casinoBal = wallet.getCasinoBalance(addr);

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('walletEthBalance', `${walletBal.toFixed(4)} ETH`);
      set('casinoBalance', `${casinoBal.toFixed(4)} ETH`);
      set('withdrawBalance', `${casinoBal.toFixed(4)} ETH`);
      set('balanceWallet', `${walletBal.toFixed(4)} ETH`);
      set('balanceCasino', `${casinoBal.toFixed(4)} ETH`);
    } catch (err) {
      console.error(err);
    }
  }

  function renderTxHistory() {
    const list = document.getElementById('txHistory');
    const txs = wallet.getTransactions(wallet.getAddress());

    if (!txs.length) {
      list.innerHTML = '<li class="tx-empty">No transactions yet</li>';
      return;
    }

    const esc = window.SBSecurity.escapeHtml;
    list.innerHTML = txs.map((tx) => `
      <li>
        <span class="tx-type-${esc(tx.type === 'lottery' ? 'deposit' : tx.type)}">${esc(tx.type)}</span>
        <span>${esc(parseFloat(tx.amount).toFixed(4))} ETH</span>
      </li>
    `).join('');
  }

  document.querySelectorAll('.wallet-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.wallet-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.wallet-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });

  async function handleConnect() {
    try {
      await wallet.connect();
      updateWalletUI();
      toast('Wallet connected securely', 'success');
    } catch (err) {
      toast(err.message || 'Connection failed', 'error');
    }
  }

  document.getElementById('walletBtn').addEventListener('click', () => openModal(walletModal));
  document.getElementById('connectWalletBtn').addEventListener('click', handleConnect);
  document.getElementById('connectForWithdraw').addEventListener('click', handleConnect);
  document.getElementById('signInBtn').addEventListener('click', handleConnect);
  document.getElementById('sidebarWalletBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal(walletModal);
  });
  document.getElementById('heroBuyBtn')?.addEventListener('click', () => {
    document.getElementById('lottery')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('promoBuyBtn')?.addEventListener('click', () => {
    document.getElementById('lottery')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('disconnectBtn').addEventListener('click', () => {
    wallet.disconnect();
    updateWalletUI();
    toast('Disconnected', 'info');
  });

  document.getElementById('walletModalClose').addEventListener('click', () => closeModal(walletModal));
  walletModal.addEventListener('click', (e) => { if (e.target === walletModal) closeModal(walletModal); });

  document.getElementById('depositMax')?.addEventListener('click', async () => {
    const bal = await wallet.getWalletBalance();
    const cfg = wallet.getConfig();
    document.getElementById('depositAmount').value = Math.min(bal * 0.95, cfg.MAX_ETH).toFixed(4);
  });

  document.querySelectorAll('.quick-amounts button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('depositAmount').value = btn.dataset.amount;
    });
  });

  document.getElementById('depositBtn')?.addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('depositAmount').value);
    showTxStatus('depositStatus', 'Confirm in wallet...', 'pending');
    try {
      await wallet.deposit(amount);
      showTxStatus('depositStatus', 'Deposit confirmed!', 'success');
      await refreshBalances();
      renderTxHistory();
      toast('Deposit successful', 'success');
    } catch (err) {
      showTxStatus('depositStatus', err.message, 'error');
      toast(err.message, 'error');
    }
  });

  document.getElementById('withdrawBtn')?.addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const to = document.getElementById('withdrawAddress').value.trim();
    showTxStatus('withdrawStatus', 'Processing...', 'pending');
    try {
      await wallet.withdraw(amount, to || undefined);
      showTxStatus('withdrawStatus', 'Withdrawal sent!', 'success');
      await refreshBalances();
      renderTxHistory();
      toast('Withdrawal processed', 'success');
    } catch (err) {
      showTxStatus('withdrawStatus', err.message, 'error');
      toast(err.message, 'error');
    }
  });

  function showTxStatus(elId, message, type) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.hidden = false;
    el.className = `tx-status ${type}`;
    el.textContent = message;
  }

  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('myTicketsLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!wallet.isConnected()) {
      openModal(walletModal);
      toast('Connect wallet to view your tickets', 'info');
      return;
    }
    const tickets = wallet.getAllTickets().filter(
      (t) => t.wallet?.toLowerCase() === wallet.getAddress()?.toLowerCase()
    );
    if (!tickets.length) {
      toast('No tickets yet — buy your first entry!', 'info');
      return;
    }
    const summary = tickets.slice(0, 3).map((t) => `#${t.id.slice(-5)}: ${t.numbers.join('-')}`).join(', ');
    toast(`Your tickets: ${summary}${tickets.length > 3 ? '...' : ''}`, 'success');
  });

  wallet.on((event) => {
    if (['connected', 'disconnected', 'ticket-purchased', 'deposit-success'].includes(event)) {
      updateWalletUI();
    }
  });

  window.LotteryApp.init();
  window.Icons?.hydrate();
  wallet.tryAutoConnect().then(() => updateWalletUI());
})();
