/**
 * Pool retention (90%), operator approval for payouts over $1k, multi-asset config
 */
const PoolPolicy = (() => {
  const STORAGE_PENDING = 'pending_payouts';
  const STORAGE_APPROVED = 'approved_payouts';

  const POLICY = {
    RETAIN_RATIO: 0.90,
    MAX_PAYOUT_RATIO: 0.10,
    AUTO_APPROVE_MAX_USD: 1000,
    ETH_USD: 3500,
    COPY: {
      PAYOUT_PROCESSING: 'Your winnings are being sent — you should receive them in your wallet shortly.',
      WITHDRAW_PROCESSING: 'Your withdrawal is processing. Funds will arrive in your wallet shortly.',
    },
    ASSETS: [
      { symbol: 'ETH', name: 'Ethereum', icon: 'ethereum', decimals: 4 },
      { symbol: 'SOL', name: 'Solana', icon: 'solana', decimals: 4 },
      { symbol: 'USDT', name: 'Tether', icon: 'circle-dollar', decimals: 2 },
      { symbol: 'USDC', name: 'USD Coin', icon: 'circle-dollar', decimals: 2 },
      { symbol: 'TRX', name: 'TRON', icon: 'zap', decimals: 2 },
    ],
  };

  function useServer() {
    return window.NeonDrawApi?.useServer?.() ?? false;
  }

  function load(key) {
    return SecureStorage.getJSON(key, []);
  }

  function save(key, data) {
    SecureStorage.setJSON(key, data);
  }

  function ethToUsd(eth) {
    return (Number(eth) || 0) * POLICY.ETH_USD;
  }

  function maxPayoutFromPool(poolUsd) {
    return Math.max(0, poolUsd * POLICY.MAX_PAYOUT_RATIO);
  }

  function retainedFromPool(poolUsd) {
    return poolUsd * POLICY.RETAIN_RATIO;
  }

  function requiresOperatorApproval(usdAmount) {
    return usdAmount >= POLICY.AUTO_APPROVE_MAX_USD;
  }

  function submitPayoutRequestLocal({ wallet, usdAmount, ethAmount, type, meta = {} }) {
    const pending = load(STORAGE_PENDING);
    const req = {
      id: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      wallet,
      usdAmount: Math.round(usdAmount * 100) / 100,
      ethAmount,
      type,
      meta,
      status: 'pending',
      createdAt: Date.now(),
    };
    pending.unshift(req);
    save(STORAGE_PENDING, pending.slice(0, 100));
    window.dispatchEvent(new CustomEvent('payout-pending', { detail: req }));
    return req;
  }

  function getPendingPayouts() {
    return load(STORAGE_PENDING).filter((p) => p.status === 'pending');
  }

  function getPendingForWallet(wallet) {
    if (!wallet) return [];
    const key = wallet.toLowerCase();
    return load(STORAGE_PENDING).filter((p) => p.wallet?.toLowerCase() === key);
  }

  function processDrawPayout(usdAmount, wallet, drawMeta) {
    if (!requiresOperatorApproval(usdAmount)) {
      return { auto: true, usd: usdAmount };
    }

    if (useServer()) {
      window.NeonDrawApi.processPayout({
        wallet,
        usdAmount,
        type: 'draw_prize',
        meta: drawMeta,
      }).catch(() => { /* server handles queue */ });
      return { auto: false, usd: usdAmount, server: true };
    }

    const req = submitPayoutRequestLocal({
      wallet,
      usdAmount,
      ethAmount: usdAmount / POLICY.ETH_USD,
      type: 'draw_prize',
      meta: drawMeta,
    });
    return { auto: false, request: req, usd: usdAmount };
  }

  function processWithdrawal(amountEth, wallet) {
    const usd = ethToUsd(amountEth);
    if (!requiresOperatorApproval(usd)) {
      return { auto: true, usd };
    }

    if (useServer()) {
      window.NeonDrawApi.processPayout({
        wallet,
        usdAmount: usd,
        type: 'withdrawal',
        meta: { amountEth },
      }).catch(() => { /* */ });
      return { auto: false, usd, server: true };
    }

    const req = submitPayoutRequestLocal({
      wallet,
      usdAmount: usd,
      ethAmount: amountEth,
      type: 'withdrawal',
    });
    return { auto: false, request: req, usd };
  }

  function notifyPayoutProcessing(wallet, usdAmount) {
    const addr = window.SecureWeb3?.getAddress?.();
    if (addr && wallet && addr.toLowerCase() !== wallet.toLowerCase()) return null;
    window.AppUI?.toast?.(POLICY.COPY.PAYOUT_PROCESSING, 'success');
    return POLICY.COPY.PAYOUT_PROCESSING;
  }

  function getRetentionSummary(poolUsd) {
    const retained = retainedFromPool(poolUsd);
    const payable = maxPayoutFromPool(poolUsd);
    return {
      poolUsd,
      retainedUsd: Math.round(retained),
      maxPayableUsd: Math.round(payable),
      retainPct: Math.round(POLICY.RETAIN_RATIO * 100),
      payoutPct: Math.round(POLICY.MAX_PAYOUT_RATIO * 100),
    };
  }

  return {
    POLICY,
    ethToUsd,
    maxPayoutFromPool,
    retainedFromPool,
    requiresOperatorApproval,
    getPendingPayouts,
    getPendingForWallet,
    processWithdrawal,
    processDrawPayout,
    getRetentionSummary,
    notifyPayoutProcessing,
  };
})();

window.PoolPolicy = PoolPolicy;
