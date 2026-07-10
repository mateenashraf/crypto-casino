/**
 * Pool helpers - payouts are instant in-app; settlement ratios stay server/contract-side.
 */
const PoolPolicy = (() => {
  // Prize fund = 95% of category entry pool; 5% platform
  const _prize = 0.95;
  const _keep = 0.05;

  const POLICY = {
    ETH_USD: 3500,
    PRIZE_FUND_RATIO: _prize,
    COPY: {
      WIN_ON_THE_WAY: 'Win on the way! Your winnings are being sent to your wallet - most players receive funds within a few minutes.',
      PAYOUT_PROCESSING: 'Your winnings are being sent to your wallet shortly.',
      WITHDRAW_PROCESSING: 'Your withdrawal is processing. Funds will arrive in your wallet shortly.',
      JACKPOT_FROM_POOL:
        'Each advertised jackpot is 95% of ticket sales collected for that draw category before the draw closes. The remaining 5% covers platform operations.',
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

  function prizeFundFromPool(poolUsd) {
    return Math.max(0, poolUsd * _prize);
  }

  function maxPayoutFromPool(poolUsd) {
    return prizeFundFromPool(poolUsd);
  }

  function retainedFromPool(poolUsd) {
    return poolUsd * _keep;
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

  /** Public pool snapshot */
  function getRetentionSummary(poolUsd) {
    return {
      poolUsd,
      retainedUsd: Math.round(retainedFromPool(poolUsd)),
      maxPayableUsd: Math.round(maxPayoutFromPool(poolUsd)),
      prizeFundUsd: Math.round(prizeFundFromPool(poolUsd)),
      prizeFundRatio: _prize,
    };
  }

  return {
    POLICY,
    ethToUsd,
    prizeFundFromPool,
    maxPayoutFromPool,
    retainedFromPool,
    processWithdrawal,
    processDrawPayout,
    getRetentionSummary,
    notifyWinOnTheWay,
  };
})();

window.PoolPolicy = PoolPolicy;
