/**
 * Secure Web3 wallet layer, chain validation, limits, on-chain lottery entries
 */
const SecureWeb3 = (() => {
  const CONFIG = {
    // Sepolia testnet (change to 1 for mainnet in production)
    ALLOWED_CHAIN_IDS: [11155111, 1],
    CHAIN_NAMES: { 1: 'Ethereum Mainnet', 11155111: 'Sepolia Testnet' },
    // IMPORTANT: set a private treasury address before production deploy.
    TREASURY_ADDRESS: '',
    // Deploy LotteryPool.sol and set address here for contract-based entries
    LOTTERY_CONTRACT: null,
    MIN_ETH: 0.001,
    MAX_ETH: 2,
    DEPOSIT_COOLDOWN_MS: 8000,
    STORAGE_BALANCES: 'starbitz_balances',
    STORAGE_TX: 'starbitz_transactions',
    STORAGE_TICKETS: 'starbitz_lottery_tickets',
    STORAGE_POOL: 'starbitz_pool_contributions',
    STORAGE_FREE_TICKETS: 'starbitz_free_tickets',
  };

  const LOTTERY_ABI = [
    'function buyTicket(uint8[6] calldata numbers) external payable',
    'function poolBalance() external view returns (uint256)',
    'event TicketPurchased(address indexed player, uint8[6] numbers, uint256 amount, uint256 ticketId)',
  ];

  let provider = null;
  let signer = null;
  let address = null;
  let chainId = null;
  let lastTxTime = 0;
  let listeners = [];

  function notify(event, data) {
    listeners.forEach((fn) => fn(event, data));
  }

  function on(callback) {
    listeners.push(callback);
    return () => { listeners = listeners.filter((f) => f !== callback); };
  }

  function assertChain() {
    if (!CONFIG.ALLOWED_CHAIN_IDS.includes(chainId)) {
      const allowed = CONFIG.ALLOWED_CHAIN_IDS.map((id) => CONFIG.CHAIN_NAMES[id] || id).join(', ');
      throw new Error(`Wrong network. Switch to: ${allowed}`);
    }
  }

  function validateAmount(amountEth) {
    const n = parseFloat(amountEth);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid amount');
    if (n < CONFIG.MIN_ETH) throw new Error(`Minimum: ${CONFIG.MIN_ETH} ETH`);
    if (n > CONFIG.MAX_ETH) throw new Error(`Maximum: ${CONFIG.MAX_ETH} ETH per transaction`);
    return n;
  }

  function rateLimit() {
    const now = Date.now();
    if (now - lastTxTime < CONFIG.DEPOSIT_COOLDOWN_MS) {
      throw new Error('Please wait a few seconds between transactions');
    }
    lastTxTime = now;
  }

  function shortenAddress(addr) {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  function getStorage(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
  }

  function setStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function getCasinoBalance(addr) {
    if (!addr) return 0;
    return parseFloat(getStorage(CONFIG.STORAGE_BALANCES)[addr.toLowerCase()] || '0');
  }

  function setCasinoBalance(addr, amount) {
    const b = getStorage(CONFIG.STORAGE_BALANCES);
    b[addr.toLowerCase()] = amount.toFixed(6);
    setStorage(CONFIG.STORAGE_BALANCES, b);
  }

  function getTransactions(addr) {
    return getStorage(CONFIG.STORAGE_TX)[addr?.toLowerCase()] || [];
  }

  function addTransaction(addr, tx) {
    const all = getStorage(CONFIG.STORAGE_TX);
    const key = addr.toLowerCase();
    all[key] = [{ ...tx, timestamp: Date.now() }, ...(all[key] || [])].slice(0, 30);
    setStorage(CONFIG.STORAGE_TX, all);
  }

  const EXPLORER_BASES = {
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
  };

  function getAllTickets() {
    try { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_TICKETS) || '[]'); } catch { return []; }
  }

  function isValidAddress(addr) {
    try {
      return ethers.isAddress(addr);
    } catch {
      return false;
    }
  }

  function normalizeAddress(addr) {
    return isValidAddress(addr) ? ethers.getAddress(addr) : null;
  }

  function looksLikePrivateKey(value) {
    const v = (value || '').trim();
    if (!v) return false;
    if (/^0x[a-fA-F0-9]{64}$/.test(v)) return true;
    if (/^[a-fA-F0-9]{64}$/.test(v)) return true;
    return false;
  }

  function looksLikeSeedPhrase(value) {
    const words = (value || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length < 12) return false;
    return words.every((w) => /^[a-z]+$/.test(w));
  }

  function assertSafeAddressInput(value, fieldName = 'address') {
    if (looksLikePrivateKey(value) || looksLikeSeedPhrase(value)) {
      throw new Error(`Never paste private keys or seed phrases into ${fieldName} fields.`);
    }
  }

  function getTicketsByAddress(addr) {
    assertSafeAddressInput(addr, 'wallet lookup');
    const normalized = normalizeAddress(addr);
    if (!normalized) return [];
    const key = normalized.toLowerCase();
    return getAllTickets().filter((t) => t.wallet?.toLowerCase() === key);
  }

  function getExplorerTxUrl(hash, chainId = 11155111) {
    const base = EXPLORER_BASES[chainId] || EXPLORER_BASES[11155111];
    return `${base}/tx/${hash}`;
  }

  function getExplorerAddressUrl(addr, chainId = 11155111) {
    const base = EXPLORER_BASES[chainId] || EXPLORER_BASES[11155111];
    return `${base}/address/${addr}`;
  }

  function saveTicket(ticket, silent = false) {
    const tickets = getAllTickets();
    tickets.unshift(ticket);
    localStorage.setItem(CONFIG.STORAGE_TICKETS, JSON.stringify(tickets.slice(0, 200)));
    if (!silent) notify('ticket-purchased', ticket);
  }

  function saveTicketsBulk(newTickets) {
    const tickets = getAllTickets();
    tickets.unshift(...newTickets);
    localStorage.setItem(CONFIG.STORAGE_TICKETS, JSON.stringify(tickets.slice(0, 200)));
  }

  function getPoolContributions() {
    return parseFloat(localStorage.getItem(CONFIG.STORAGE_POOL) || '0');
  }

  function addPoolContribution(usdAmount) {
    const total = getPoolContributions() + usdAmount;
    localStorage.setItem(CONFIG.STORAGE_POOL, total.toFixed(2));
    notify('pool-updated', { total });
    return total;
  }

  function getFreeTicketBalance(addr) {
    if (!addr) return 0;
    return parseInt(getStorage(CONFIG.STORAGE_FREE_TICKETS)[addr.toLowerCase()] || '0', 10);
  }

  function grantFreeTickets(addr, qty = 1, meta = {}) {
    if (!addr) return 0;
    const key = addr.toLowerCase();
    const credits = getStorage(CONFIG.STORAGE_FREE_TICKETS);
    const next = (parseInt(credits[key] || '0', 10) + qty);
    credits[key] = next;
    setStorage(CONFIG.STORAGE_FREE_TICKETS, credits);
    notify('free-ticket-granted', { address: addr, qty, balance: next, ...meta });
    return next;
  }

  function validateNumbers(numbers) {
    if (!Array.isArray(numbers) || numbers.length !== 6) {
      throw new Error('Select exactly 6 numbers');
    }
    const unique = new Set(numbers);
    if (unique.size !== 6) throw new Error('Numbers must be unique');
    if (numbers.some((n) => n < 1 || n > 49)) throw new Error('Numbers must be 1–49');
    return [...numbers].sort((a, b) => a - b);
  }

  function redeemFreeTicket(numbers, drawId) {
    if (!address) throw new Error('Connect wallet first');
    const balance = getFreeTicketBalance(address);
    if (balance < 1) throw new Error('No free tickets available');

    const sorted = validateNumbers(numbers);
    const ticket = {
      id: `FT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      wallet: address,
      numbers: sorted,
      amountEth: 0,
      usdPrice: 0,
      hash: null,
      chainId: chainId || 11155111,
      timestamp: Date.now(),
      free: true,
      drawId: drawId || null,
      prizeSource: 'free_ticket_bonus',
    };

    const credits = getStorage(CONFIG.STORAGE_FREE_TICKETS);
    credits[address.toLowerCase()] = balance - 1;
    setStorage(CONFIG.STORAGE_FREE_TICKETS, credits);

    saveTicket(ticket, true);
    notify('free-ticket-redeemed', ticket);
    notify('ticket-purchased', ticket);
    return ticket;
  }

  async function connect() {
    if (!window.ethereum) {
      throw new Error('No Web3 wallet found. Install MetaMask.');
    }

    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    signer = await provider.getSigner();
    address = ethers.getAddress(accounts[0]);
    const network = await provider.getNetwork();
    chainId = Number(network.chainId);

    assertChain();

    window.ethereum.on?.('accountsChanged', (accs) => {
      if (!accs.length) disconnect();
      else { address = ethers.getAddress(accs[0]); notify('connected', { address, chainId }); }
    });
    window.ethereum.on?.('chainChanged', () => window.location.reload());

    notify('connected', { address, chainId });
    return { address, chainId };
  }

  function disconnect() {
    provider = signer = address = null;
    chainId = null;
    notify('disconnected', {});
  }

  async function getWalletBalance() {
    if (!provider || !address) return 0;
    const bal = await provider.getBalance(address);
    return parseFloat(ethers.formatEther(bal));
  }

  async function sendSecureTransaction(to, valueEth) {
    assertChain();
    rateLimit();
    const amount = validateAmount(valueEth);
    if (!CONFIG.TREASURY_ADDRESS || !isValidAddress(CONFIG.TREASURY_ADDRESS)) {
      throw new Error('Treasury wallet is not configured. Set TREASURY_ADDRESS in js/wallet.js');
    }
    const toAddr = ethers.getAddress(to);

    if (toAddr.toLowerCase() !== CONFIG.TREASURY_ADDRESS.toLowerCase() && !CONFIG.LOTTERY_CONTRACT) {
      throw new Error('Invalid recipient address');
    }

    const walletBal = await getWalletBalance();
    if (amount > walletBal) throw new Error('Insufficient wallet balance');

    const tx = await signer.sendTransaction({
      to: toAddr,
      value: ethers.parseEther(amount.toString()),
      chainId,
    });

    notify('tx-pending', { hash: tx.hash });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('Transaction failed on-chain');
    return receipt;
  }

  async function buyLotteryTicket(amountEth, numbers, usdPrice) {
    const tickets = await buyLotteryTicketBulk(amountEth, numbers, usdPrice, 1, usdPrice);
    return tickets[0];
  }

  async function buyLotteryTicketBulk(totalEth, numbers, usdTotal, quantity, unitUsd) {
    if (!signer || !address) throw new Error('Connect wallet first');
    if (!Array.isArray(numbers) || numbers.length !== 6) {
      throw new Error('Select exactly 6 numbers');
    }

    const qty = Math.max(1, Math.floor(quantity));
    const unique = new Set(numbers);
    if (unique.size !== 6) throw new Error('Numbers must be unique');
    if (numbers.some((n) => n < 1 || n > 49)) throw new Error('Numbers must be 1–49');
    if (usdTotal <= 0) throw new Error('Invalid ticket amount');

    let receipt;
    const dest = CONFIG.LOTTERY_CONTRACT || CONFIG.TREASURY_ADDRESS;

    if (CONFIG.LOTTERY_CONTRACT) {
      assertChain();
      rateLimit();
      validateAmount(totalEth);
      const contract = new ethers.Contract(CONFIG.LOTTERY_CONTRACT, LOTTERY_ABI, signer);
      const tx = await contract.buyTicket(numbers, {
        value: ethers.parseEther(totalEth.toString()),
      });
      notify('tx-pending', { hash: tx.hash });
      receipt = await tx.wait();
    } else {
      receipt = await sendSecureTransaction(dest, totalEth);
    }

    const sorted = [...numbers].sort((a, b) => a - b);
    const perTicketUsd = unitUsd || usdTotal / qty;
    const perTicketEth = totalEth / qty;
    const baseTime = Date.now();
    const tickets = [];

    for (let i = 0; i < qty; i++) {
      tickets.push({
        id: `T-${baseTime}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        wallet: address,
        numbers: sorted,
        amountEth: parseFloat(perTicketEth.toFixed(6)),
        usdPrice: parseFloat(perTicketUsd.toFixed(2)),
        hash: receipt.hash,
        chainId,
        timestamp: baseTime + i,
        bundleIndex: qty > 1 ? i + 1 : null,
        bundleTotal: qty > 1 ? qty : null,
      });
    }

    saveTicketsBulk(tickets);
    addPoolContribution(usdTotal);
    addTransaction(address, {
      type: 'lottery',
      amount: totalEth,
      hash: receipt.hash,
      ticketId: tickets[0].id,
      quantity: qty,
      usdTotal,
    });

    const summary = {
      ...tickets[tickets.length - 1],
      quantity: qty,
      usdTotal,
      tickets,
    };
    notify('ticket-success', summary);
    notify('ticket-purchased', summary);
    return tickets;
  }

  async function deposit(amountEth) {
    const receipt = await sendSecureTransaction(CONFIG.TREASURY_ADDRESS, amountEth);
    const current = getCasinoBalance(address);
    setCasinoBalance(address, current + amountEth);
    addTransaction(address, { type: 'deposit', amount: amountEth, hash: receipt.hash, status: 'confirmed' });
    notify('deposit-success', { amount: amountEth, hash: receipt.hash });
    return receipt;
  }

  async function withdraw(amountEth, toAddress) {
    if (!address) throw new Error('Wallet not connected');
    const amount = validateAmount(amountEth);
    const casinoBal = getCasinoBalance(address);
    if (amount > casinoBal) throw new Error('Insufficient balance');

    const policy = window.PoolPolicy?.processWithdrawal?.(amount, address);
    if (policy && !policy.auto) {
      setCasinoBalance(address, casinoBal - amount);
      addTransaction(address, {
        type: 'withdraw_pending',
        amount,
        hash: null,
        status: 'pending_operator',
        requestId: policy.request?.id,
        usd: policy.usd,
      });
      notify('payout-pending', policy.request);
      throw new Error(`Withdrawal over $1,000 requires operator approval (request ${policy.request?.id})`);
    }

    if (toAddress) assertSafeAddressInput(toAddress, 'withdraw destination');
    const dest = toAddress ? ethers.getAddress(toAddress) : address;
    await new Promise((r) => setTimeout(r, 1200));

    setCasinoBalance(address, casinoBal - amount);
    const fakeHash = ethers.hexlify(ethers.randomBytes(32));
    addTransaction(address, { type: 'withdraw', amount, hash: fakeHash, to: dest, status: 'demo' });
    notify('withdraw-success', { amount, hash: fakeHash });
    return { hash: fakeHash };
  }

  async function tryAutoConnect() {
    if (!window.ethereum) return false;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) { await connect(); return true; }
    } catch { /* ignore */ }
    return false;
  }

  function getConfig() { return { ...CONFIG }; }

  return {
    connect, disconnect, deposit, withdraw, buyLotteryTicket, buyLotteryTicketBulk,
    redeemFreeTicket, grantFreeTickets, getFreeTicketBalance,
    getWalletBalance, getCasinoBalance, getTransactions, getAllTickets, getTicketsByAddress,
    getExplorerTxUrl, getExplorerAddressUrl, isValidAddress, normalizeAddress,
    assertSafeAddressInput,
    getPoolContributions, isConnected: () => !!address,
    getAddress: () => address, getChainId: () => chainId,
    getTreasuryAddress: () => CONFIG.TREASURY_ADDRESS,
    setCasinoBalance,
    shortenAddress, on, tryAutoConnect, getConfig,
    formatEth: (eth) => `${parseFloat(eth).toFixed(4)} ETH`,
  };
})();

window.WalletManager = SecureWeb3;
window.SecureWeb3 = SecureWeb3;
