/**
 * Pool retention display — payouts are instant in-app; no operator queue or server contact.
 */
const PoolPolicy = (() => {
  const POLICY = {
    RETAIN_RATIO: 0.90,
    MAX_PAYOUT_RATIO: 0.10,
    ETH_USD: 3500,
    COPY: {
      WIN_ON_THE_WAY: 'Win on the way! Your winnings are being sent to your wallet — most players receive funds within a few minutes.',
      PAYOUT_PROCESSING: 'Your winnings are being sent to your wallet shortly.',
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

  function ethToUsd(eth) {
    return (Number(eth) || 0) * POLICY.ETH_USD;
  }

  function maxPayoutFromPool(poolUsd) {
    return Math.max(0, poolUsd * POLICY.MAX_PAYOUT_RATIO);
  }

  function retainedFromPool(poolUsd) {
    return poolUsd * POLICY.RETAIN_RATIO;
  }

  function processDrawPayout(usdAmount) {
    return { auto: true, usd: usdAmount };
  }

  function processWithdrawal(amountEth) {
    return { auto: true, usd: ethToUsd(amountEth) };
  }

  function notifyWinOnTheWay(wallet) {
    const addr = window.SecureWeb3?.getAddress?.();
    if (wallet && addr && wallet.toLowerCase() !== addr.toLowerCase()) return;
    window.AppUI?.toast?.(POLICY.COPY.WIN_ON_THE_WAY, 'success');
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
    processWithdrawal,
    processDrawPayout,
    getRetentionSummary,
    notifyWinOnTheWay,
  };
})();

window.PoolPolicy = PoolPolicy;
