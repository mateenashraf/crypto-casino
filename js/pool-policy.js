/**
 * Pool retention (90%), operator approval for payouts over $1k, multi-asset config
 */
const PoolPolicy = (() => {
  const STORAGE_PENDING = 'starbitz_pending_payouts';
  const STORAGE_APPROVED = 'starbitz_approved_payouts';

  const POLICY = {
    RETAIN_RATIO: 0.90,
    MAX_PAYOUT_RATIO: 0.10,
    AUTO_APPROVE_MAX_USD: 1000,
    ETH_USD: 3500,
    OPERATOR_WALLET: '',
    ASSETS: [
      { symbol: 'ETH', name: 'Ethereum', icon: 'ethereum', decimals: 4 },
      { symbol: 'SOL', name: 'Solana', icon: 'solana', decimals: 4 },
      { symbol: 'USDT', name: 'Tether', icon: 'circle-dollar', decimals: 2 },
      { symbol: 'USDC', name: 'USD Coin', icon: 'circle-dollar', decimals: 2 },
      { symbol: 'TRX', name: 'TRON', icon: 'zap', decimals: 2 },
    ],
  };

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
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

  function getOperatorWallet() {
    const treasury = window.SecureWeb3?.getTreasuryAddress?.() || '';
    return POLICY.OPERATOR_WALLET || treasury;
  }

  function isOperator(addr) {
    if (!addr) return false;
    const op = getOperatorWallet();
    if (!op) return false;
    return addr.toLowerCase() === op.toLowerCase();
  }

  function submitPayoutRequest({ wallet, usdAmount, ethAmount, type, meta = {} }) {
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

  function resolvePayout(id, approved, operatorWallet) {
    const pending = load(STORAGE_PENDING);
    const idx = pending.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error('Request not found');
    const req = pending[idx];
    req.status = approved ? 'approved' : 'rejected';
    req.resolvedAt = Date.now();
    req.resolvedBy = operatorWallet;
    pending[idx] = req;
    save(STORAGE_PENDING, pending);

    const history = load(STORAGE_APPROVED);
    history.unshift(req);
    save(STORAGE_APPROVED, history.slice(0, 200));

    window.dispatchEvent(new CustomEvent(approved ? 'payout-approved' : 'payout-rejected', { detail: req }));
    return req;
  }

  function processWithdrawal(amountEth, wallet) {
    const usd = ethToUsd(amountEth);
    if (!requiresOperatorApproval(usd)) {
      return { auto: true, usd };
    }
    const req = submitPayoutRequest({
      wallet,
      usdAmount: usd,
      ethAmount: amountEth,
      type: 'withdrawal',
    });
    return { auto: false, request: req, usd };
  }

  function processDrawPayout(usdAmount, wallet, drawMeta) {
    if (!requiresOperatorApproval(usdAmount)) {
      return { auto: true, usd: usdAmount };
    }
    const req = submitPayoutRequest({
      wallet,
      usdAmount,
      ethAmount: usdAmount / POLICY.ETH_USD,
      type: 'draw_prize',
      meta: drawMeta,
    });
    return { auto: false, request: req, usd: usdAmount };
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
    isOperator,
    submitPayoutRequest,
    getPendingPayouts,
    getPendingForWallet,
    resolvePayout,
    processWithdrawal,
    processDrawPayout,
    getRetentionSummary,
  };
})();

window.PoolPolicy = PoolPolicy;
