/**
 * Web3 wallet integration — MetaMask / EIP-1193 providers
 * Deposits: on-chain ETH transfer to treasury address
 * Casino balance: tracked per-wallet in localStorage (demo layer)
 */
const WalletManager = (() => {
  // Demo treasury — replace with your contract address in production
  const TREASURY_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
  const STORAGE_KEY = 'starbitz_balances';
  const TX_KEY = 'starbitz_transactions';

  let provider = null;
  let signer = null;
  let address = null;
  let chainId = null;
  let listeners = [];

  function notify(event, data) {
    listeners.forEach((fn) => fn(event, data));
  }

  function on(callback) {
    listeners.push(callback);
    return () => { listeners = listeners.filter((f) => f !== callback); };
  }

  function getBalances() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveBalances(balances) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(balances));
  }

  function getCasinoBalance(addr) {
    if (!addr) return 0;
    const balances = getBalances();
    return parseFloat(balances[addr.toLowerCase()] || '0');
  }

  function setCasinoBalance(addr, amount) {
    const balances = getBalances();
    balances[addr.toLowerCase()] = amount.toFixed(6);
    saveBalances(balances);
  }

  function getTransactions(addr) {
    try {
      const all = JSON.parse(localStorage.getItem(TX_KEY) || '{}');
      return all[addr?.toLowerCase()] || [];
    } catch {
      return [];
    }
  }

  function addTransaction(addr, tx) {
    const all = JSON.parse(localStorage.getItem(TX_KEY) || '{}');
    const key = addr.toLowerCase();
    all[key] = [{ ...tx, timestamp: Date.now() }, ...(all[key] || [])].slice(0, 20);
    localStorage.setItem(TX_KEY, JSON.stringify(all));
  }

  function shortenAddress(addr) {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  function formatEth(weiOrEth, isWei = false) {
    const eth = isWei ? parseFloat(ethers.formatEther(weiOrEth)) : weiOrEth;
    return `${eth.toFixed(4)} ETH`;
  }

  async function connect() {
    if (!window.ethereum) {
      throw new Error('No Web3 wallet found. Install MetaMask or another EIP-1193 wallet.');
    }

    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    signer = await provider.getSigner();
    address = accounts[0];
    const network = await provider.getNetwork();
    chainId = Number(network.chainId);

    window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    window.ethereum.on?.('chainChanged', () => window.location.reload());

    notify('connected', { address, chainId });
    return { address, chainId };
  }

  function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
      disconnect();
    } else {
      address = accounts[0];
      notify('connected', { address, chainId });
    }
  }

  function disconnect() {
    provider = null;
    signer = null;
    address = null;
    chainId = null;
    notify('disconnected', {});
  }

  async function getWalletBalance() {
    if (!provider || !address) return 0;
    const balance = await provider.getBalance(address);
    return parseFloat(ethers.formatEther(balance));
  }

  async function deposit(amountEth) {
    if (!signer || !address) throw new Error('Wallet not connected');
    if (amountEth <= 0) throw new Error('Invalid amount');

    const walletBal = await getWalletBalance();
    if (amountEth > walletBal) throw new Error('Insufficient wallet balance');

    const tx = await signer.sendTransaction({
      to: TREASURY_ADDRESS,
      value: ethers.parseEther(amountEth.toString()),
    });

    notify('tx-pending', { hash: tx.hash, type: 'deposit' });

    const receipt = await tx.wait();

    const current = getCasinoBalance(address);
    setCasinoBalance(address, current + amountEth);
    addTransaction(address, {
      type: 'deposit',
      amount: amountEth,
      hash: receipt.hash,
      status: 'confirmed',
    });

    notify('deposit-success', { amount: amountEth, hash: receipt.hash });
    return receipt;
  }

  async function withdraw(amountEth, toAddress) {
    if (!address) throw new Error('Wallet not connected');
    if (amountEth <= 0) throw new Error('Invalid amount');

    const casinoBal = getCasinoBalance(address);
    if (amountEth > casinoBal) throw new Error('Insufficient casino balance');

    const dest = toAddress || address;
    if (!ethers.isAddress(dest)) throw new Error('Invalid destination address');

    // Demo: simulate withdrawal (production would use backend + hot wallet)
    await new Promise((r) => setTimeout(r, 1500));

    setCasinoBalance(address, casinoBal - amountEth);
    const fakeHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    addTransaction(address, {
      type: 'withdraw',
      amount: amountEth,
      hash: fakeHash,
      to: dest,
      status: 'confirmed',
    });

    notify('withdraw-success', { amount: amountEth, hash: fakeHash, to: dest });
    return { hash: fakeHash };
  }

  function isConnected() {
    return !!address;
  }

  function getAddress() {
    return address;
  }

  function getTreasuryAddress() {
    return TREASURY_ADDRESS;
  }

  // Auto-reconnect if previously connected
  async function tryAutoConnect() {
    if (!window.ethereum) return false;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        await connect();
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  return {
    connect,
    disconnect,
    deposit,
    withdraw,
    getWalletBalance,
    getCasinoBalance,
    getTransactions,
    isConnected,
    getAddress,
    getTreasuryAddress,
    shortenAddress,
    formatEth,
    on,
    tryAutoConnect,
  };
})();

window.WalletManager = WalletManager;
