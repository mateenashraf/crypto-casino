/**
 * Checkout & wallet limits - USD amounts and on-chain conversion.
 * Lottery/deposit: one on-chain tx. Slots/roulette: casino balance only (no gas per bet).
 */
const TicketPricing = (() => {
  const MIN_TICKET_USD = 10;
  const MIN_DEPOSIT_USD = 10;
  const MIN_SLOT_BET_USD = 1;
  const MIN_ROULETTE_BET_USD = 0.5;
  const MAX_TICKET_USD = 10_000;
  const MAX_DEPOSIT_USD = 10_000;

  /** @deprecated Use NetworkFee.getRange - kept for compatibility */
  function getEstGasUsd(chainId) {
    const r = window.NetworkFee?.getRange?.(chainId) || { low: 0.35, high: 12 };
    return (r.low + r.high) / 2;
  }

  function getEthUsd() {
    return window.PoolPolicy?.POLICY?.ETH_USD || 3500;
  }

  function getMinCheckoutUsd() {
    return MIN_TICKET_USD;
  }

  function usdToEth(usd) {
    return parseFloat((usd / getEthUsd()).toFixed(6));
  }

  function ethToUsd(eth) {
    return parseFloat((eth * getEthUsd()).toFixed(2));
  }

  function formatUsd(n) {
    const v = Number(n) || 0;
    if (v >= 1000) return '$' + Math.round(v).toLocaleString();
    if (Number.isInteger(v)) return '$' + v;
    return '$' + v.toFixed(2);
  }

  function clampPoolUsd(poolUsd) {
    return Math.min(MAX_TICKET_USD, Math.max(MIN_TICKET_USD, Math.floor(Number(poolUsd) || MIN_TICKET_USD)));
  }

  function quote(poolUsd, quantity) {
    const pool = clampPoolUsd(poolUsd);
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const checkoutUsd = pool;
    return {
      quantity: qty,
      poolUsd: pool,
      gasUsd: 0,
      checkoutUsd,
      checkoutEth: usdToEth(checkoutUsd),
      unitPoolUsd: pool / qty,
      minCheckoutUsd: MIN_TICKET_USD,
    };
  }

  function maxCheckoutForWalletUsd(walletUsd) {
    if (walletUsd < MIN_TICKET_USD) return 0;
    return Math.min(MAX_TICKET_USD, Math.floor(walletUsd));
  }

  function validateDepositUsd(usd) {
    const n = Number(usd);
    if (!Number.isFinite(n) || n < MIN_DEPOSIT_USD) {
      throw new Error(`Minimum deposit is ${formatUsd(MIN_DEPOSIT_USD)}`);
    }
    if (n > MAX_DEPOSIT_USD) {
      throw new Error(`Maximum deposit is ${formatUsd(MAX_DEPOSIT_USD)}`);
    }
    return n;
  }

  function validateDepositEth(eth, chainId) {
    const usd = ethToUsd(eth);
    validateDepositUsd(usd);
    const minEth = usdToEth(MIN_DEPOSIT_USD);
    if (eth < minEth) {
      throw new Error(`Minimum deposit is ${formatUsd(MIN_DEPOSIT_USD)} (~${minEth} ETH)`);
    }
    return eth;
  }

  function validateLotteryEth(eth) {
    const minEth = usdToEth(MIN_TICKET_USD);
    const n = parseFloat(eth);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid amount');
    if (n < minEth) {
      throw new Error(`Minimum ticket is ${formatUsd(MIN_TICKET_USD)} (~${minEth} ETH)`);
    }
    return n;
  }

  return {
    MIN_TICKET_USD,
    MIN_DEPOSIT_USD,
    MIN_SLOT_BET_USD,
    MIN_ROULETTE_BET_USD,
    MAX_TICKET_USD,
    MAX_DEPOSIT_USD,
    getEthUsd,
    getEstGasUsd,
    getMinCheckoutUsd,
    usdToEth,
    ethToUsd,
    formatUsd,
    quote,
    maxCheckoutForWalletUsd,
    validateDepositUsd,
    validateDepositEth,
    validateLotteryEth,
  };
})();

window.TicketPricing = TicketPricing;
