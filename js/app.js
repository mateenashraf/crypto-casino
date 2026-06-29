/**
 * StarBitz — main application logic
 */
(function () {
  const { GameCatalog } = window;
  const wallet = window.WalletManager;

  // DOM refs
  const walletModal = document.getElementById('walletModal');
  const searchModal = document.getElementById('searchModal');
  const gameModal = document.getElementById('gameModal');
  const toastContainer = document.getElementById('toastContainer');

  let selectedGame = null;
  let searchFilter = 'all';

  // --- Toast ---
  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // --- Modals ---
  function openModal(modal) {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal(modal) {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  // --- Render games ---
  function initGameSliders() {
    GameCatalog.renderGameSlider('popularGames', GameCatalog.getGamesByCategory('slots', 14));
    GameCatalog.renderGameSlider('newGames', GameCatalog.getGamesByCategory('new', 14));
    GameCatalog.renderGameSlider('liveGames', GameCatalog.getGamesByCategory('live', 14));
    GameCatalog.renderGameSlider('jackpotGames', GameCatalog.getGamesByCategory('jackpot', 14));
  }

  function bindGameCards() {
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.game-card');
      if (!card) return;
      const game = GameCatalog.getGameById(card.dataset.gameId);
      if (game) openGameModal(game);
    });
  }

  function openGameModal(game) {
    selectedGame = game;
    document.getElementById('gamePreviewIcon').textContent = game.icon;
    document.getElementById('gamePreviewTitle').textContent = game.title;
    document.getElementById('gamePreviewProvider').textContent = game.provider;
    document.getElementById('gameSimulator').hidden = true;
    document.querySelector('.game-preview').hidden = false;
    openModal(gameModal);
  }

  // --- Wallet UI ---
  function updateWalletUI() {
    const connected = wallet.isConnected();
    const addr = wallet.getAddress();

    const btnText = document.getElementById('walletBtnText');
    const sidebarBal = document.getElementById('sidebarBalance');
    const sidebarAmt = document.getElementById('sidebarBalanceAmount');
    const walletAddr = document.getElementById('walletAddress');
    const disconnectBtn = document.getElementById('disconnectBtn');

    if (connected) {
      btnText.textContent = wallet.shortenAddress(addr);
      sidebarBal.hidden = false;
      sidebarAmt.textContent = `${wallet.getCasinoBalance(addr).toFixed(4)} ETH`;
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

      document.getElementById('walletEthBalance').textContent = `${walletBal.toFixed(4)} ETH`;
      document.getElementById('casinoBalance').textContent = `${casinoBal.toFixed(4)} ETH`;
      document.getElementById('withdrawBalance').textContent = `${casinoBal.toFixed(4)} ETH`;
      document.getElementById('balanceWallet').textContent = `${walletBal.toFixed(4)} ETH`;
      document.getElementById('balanceCasino').textContent = `${casinoBal.toFixed(4)} ETH`;
      document.getElementById('sidebarBalanceAmount').textContent = `${casinoBal.toFixed(4)} ETH`;
      document.getElementById('gameBalance').textContent = casinoBal.toFixed(4);
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

    list.innerHTML = txs.map((tx) => `
      <li>
        <span class="tx-type-${tx.type}">${tx.type === 'deposit' ? '↓' : '↑'} ${tx.type}</span>
        <span>${parseFloat(tx.amount).toFixed(4)} ETH</span>
      </li>
    `).join('');
  }

  function showTxStatus(elId, message, type) {
    const el = document.getElementById(elId);
    el.hidden = false;
    el.className = `tx-status ${type}`;
    el.textContent = message;
  }

  // --- Wallet tabs ---
  document.querySelectorAll('.wallet-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.wallet-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.wallet-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // --- Connect ---
  async function handleConnect() {
    try {
      await wallet.connect();
      updateWalletUI();
      toast('Wallet connected!', 'success');
    } catch (err) {
      toast(err.message || 'Failed to connect wallet', 'error');
    }
  }

  document.getElementById('walletBtn').addEventListener('click', () => {
    openModal(walletModal);
    if (!wallet.isConnected()) {
      document.querySelector('.wallet-tab[data-tab="deposit"]').click();
    }
  });

  document.getElementById('connectWalletBtn').addEventListener('click', handleConnect);
  document.getElementById('connectForWithdraw').addEventListener('click', handleConnect);
  document.getElementById('signInBtn').addEventListener('click', handleConnect);
  document.getElementById('heroDepositBtn').addEventListener('click', () => {
    openModal(walletModal);
  });

  document.getElementById('disconnectBtn').addEventListener('click', () => {
    wallet.disconnect();
    updateWalletUI();
    toast('Wallet disconnected', 'info');
  });

  document.getElementById('walletModalClose').addEventListener('click', () => closeModal(walletModal));
  walletModal.addEventListener('click', (e) => { if (e.target === walletModal) closeModal(walletModal); });

  // --- Deposit ---
  document.getElementById('depositMax').addEventListener('click', async () => {
    const bal = await wallet.getWalletBalance();
    document.getElementById('depositAmount').value = (bal * 0.95).toFixed(4);
  });

  document.querySelectorAll('.quick-amounts button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('depositAmount').value = btn.dataset.amount;
    });
  });

  document.getElementById('depositBtn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('depositAmount').value);
    if (!amount || amount <= 0) {
      toast('Enter a valid deposit amount', 'error');
      return;
    }

    const statusEl = 'depositStatus';
    showTxStatus(statusEl, 'Confirm transaction in your wallet...', 'pending');

    try {
      const receipt = await wallet.deposit(amount);
      showTxStatus(statusEl, `Deposit confirmed! Tx: ${receipt.hash.slice(0, 18)}...`, 'success');
      await refreshBalances();
      renderTxHistory();
      toast(`Deposited ${amount} ETH successfully!`, 'success');
    } catch (err) {
      const msg = err.reason || err.message || 'Deposit failed';
      showTxStatus(statusEl, msg, 'error');
      toast(msg, 'error');
    }
  });

  // --- Withdraw ---
  document.getElementById('withdrawBtn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const to = document.getElementById('withdrawAddress').value.trim();

    if (!amount || amount <= 0) {
      toast('Enter a valid withdrawal amount', 'error');
      return;
    }

    showTxStatus('withdrawStatus', 'Processing withdrawal...', 'pending');

    try {
      const result = await wallet.withdraw(amount, to || undefined);
      showTxStatus('withdrawStatus', `Withdrawal sent! Ref: ${result.hash.slice(0, 18)}...`, 'success');
      await refreshBalances();
      renderTxHistory();
      toast(`Withdrew ${amount} ETH`, 'success');
    } catch (err) {
      showTxStatus('withdrawStatus', err.message, 'error');
      toast(err.message, 'error');
    }
  });

  // --- Search ---
  function renderSearchResults(query = '') {
    const results = GameCatalog.searchGames(query, searchFilter);
    const container = document.getElementById('searchResults');
    container.innerHTML = results.length
      ? results.slice(0, 24).map(GameCatalog.renderGameCard).join('')
      : '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px">No games found</p>';
  }

  document.getElementById('searchBtn').addEventListener('click', () => {
    openModal(searchModal);
    renderSearchResults();
    document.getElementById('gameSearchInput').focus();
  });

  document.getElementById('searchModalClose').addEventListener('click', () => closeModal(searchModal));
  searchModal.addEventListener('click', (e) => { if (e.target === searchModal) closeModal(searchModal); });

  document.getElementById('gameSearchInput').addEventListener('input', (e) => {
    renderSearchResults(e.target.value);
  });

  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      searchFilter = chip.dataset.filter;
      renderSearchResults(document.getElementById('gameSearchInput').value);
    });
  });

  // --- Sidebar category filter ---
  document.querySelectorAll('.sidebar-item[data-category]').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-item').forEach((i) => i.classList.remove('active'));
      item.classList.add('active');
      const cat = item.dataset.category;
      if (cat !== 'all') {
        openModal(searchModal);
        searchFilter = cat === 'new' ? 'all' : cat;
        document.getElementById('gameSearchInput').value = '';
        renderSearchResults('');
      }
    });
  });

  // --- Mobile menu ---
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // --- Game play / slot simulator ---
  const symbols = ['🍒', '🍋', '⭐', '💎', '7️⃣', '🍀'];

  document.getElementById('playGameBtn').addEventListener('click', () => {
    if (!wallet.isConnected()) {
      closeModal(gameModal);
      openModal(walletModal);
      toast('Connect wallet and deposit to play', 'info');
      return;
    }
    const bal = wallet.getCasinoBalance(wallet.getAddress());
    if (bal <= 0) {
      toast('Deposit funds to play', 'error');
      return;
    }
    document.querySelector('.game-preview').hidden = true;
    document.getElementById('gameSimulator').hidden = false;
    refreshBalances();
  });

  document.getElementById('demoPlayBtn').addEventListener('click', () => {
    document.querySelector('.game-preview').hidden = true;
    document.getElementById('gameSimulator').hidden = false;
    document.getElementById('gameBalance').textContent = '∞';
  });

  document.getElementById('gameModalClose').addEventListener('click', () => closeModal(gameModal));
  gameModal.addEventListener('click', (e) => { if (e.target === gameModal) closeModal(gameModal); });

  document.getElementById('spinBtn').addEventListener('click', async () => {
    const bet = parseFloat(document.getElementById('betAmount').value) || 0.001;
    const isDemo = document.getElementById('gameBalance').textContent === '∞';
    const addr = wallet.getAddress();
    const balance = isDemo ? Infinity : wallet.getCasinoBalance(addr);

    if (!isDemo && bet > balance) {
      toast('Insufficient balance', 'error');
      return;
    }

    const reels = document.querySelectorAll('.reel');
    reels.forEach((r) => r.classList.add('spinning'));

    await new Promise((r) => setTimeout(r, 1200));

    const results = reels.map((r) => {
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      r.textContent = sym;
      r.classList.remove('spinning');
      return sym;
    });

    const allSame = results.every((s) => s === results[0]);
    const resultEl = document.getElementById('slotResult');

    if (!isDemo) {
      if (allSame) {
        const win = bet * 10;
        wallet.setCasinoBalance(addr, balance - bet + win);
        resultEl.textContent = `🎉 JACKPOT! Won ${win.toFixed(4)} ETH`;
        toast(`You won ${win.toFixed(4)} ETH!`, 'success');
      } else if (results[0] === results[1] || results[1] === results[2]) {
        const win = bet * 2;
        wallet.setCasinoBalance(addr, balance - bet + win);
        resultEl.textContent = `Nice! Won ${win.toFixed(4)} ETH`;
      } else {
        wallet.setCasinoBalance(addr, balance - bet);
        resultEl.textContent = `No luck. Lost ${bet.toFixed(4)} ETH`;
      }
      refreshBalances();
    } else {
      resultEl.textContent = allSame ? '🎉 Demo jackpot!' : 'Try again!';
    }
  });

  // --- Live jackpot counter ---
  function animateJackpot() {
    const el = document.getElementById('statJackpot');
    let base = 12847392;
    setInterval(() => {
      base += Math.floor(Math.random() * 500) + 50;
      el.textContent = '$' + base.toLocaleString();
    }, 3000);
  }

  // --- Hero carousel ---
  const heroSlides = document.querySelectorAll('.hero-slide');
  const heroDots = document.querySelectorAll('.hero-dot');
  let heroIndex = 0;

  if (heroSlides.length > 1) {
    setInterval(() => {
      heroSlides[heroIndex]?.classList.remove('active');
      heroDots[heroIndex]?.classList.remove('active');
      heroIndex = (heroIndex + 1) % heroDots.length;
      heroDots[heroIndex]?.classList.add('active');
    }, 6000);
  }

  // --- Currency chips ---
  document.querySelectorAll('.currency-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.currency-option').forEach((o) => o.classList.remove('active'));
      opt.classList.add('active');
      if (opt.dataset.symbol !== 'ETH') {
        toast(`${opt.dataset.symbol} support coming soon — using ETH for now`, 'info');
      }
    });
  });

  document.querySelectorAll('.crypto-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.crypto-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // --- Wallet events ---
  wallet.on((event) => {
    if (event === 'connected' || event === 'disconnected') updateWalletUI();
    if (event === 'deposit-success' || event === 'withdraw-success') refreshBalances();
  });

  // --- Init ---
  initGameSliders();
  bindGameCards();
  animateJackpot();
  wallet.tryAutoConnect().then(() => updateWalletUI());

  // Pre-fill withdraw address when connected
  wallet.on((event, data) => {
    if (event === 'connected' && data.address) {
      document.getElementById('withdrawAddress').placeholder = data.address;
    }
  });
})();
