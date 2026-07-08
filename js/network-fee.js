/**
 * Player-paid blockchain network fees — NeonDraw never collects gas.
 * Estimates vary with traffic; live quote when wallet is connected.
 */
const NetworkFee = (() => {
  const RANGES_USD_BY_CHAIN = {
    1: { low: 0.35, high: 12, network: 'Ethereum mainnet' },
    11155111: { low: 0.02, high: 0.45, network: 'Sepolia testnet' },
  };
  const DEFAULT_RANGE = { low: 0.35, high: 12, network: 'Ethereum' };

  const COPY = {
    short: 'Paid by you in MetaMask to the blockchain — not NeonDraw.',
    long: 'Blockchain network fees (gas) are set by the Ethereum network and paid from your wallet when you confirm in MetaMask. NeonDraw does not charge, keep, or subsidize this fee. 100% of your ticket or deposit amount goes to the prize pool or casino balance.',
    deposit: 'One network fee when you deposit. Slots and roulette use your balance with no extra on-chain fees per bet.',
    lottery: 'Your ticket payment goes entirely to the prize pool. MetaMask shows a separate network fee that goes to validators — not to us.',
  };

  function getRange(chainId) {
    return RANGES_USD_BY_CHAIN[chainId] || DEFAULT_RANGE;
  }

  function formatUsd(n) {
    return window.TicketPricing?.formatUsd?.(n) || `$${Number(n).toFixed(2)}`;
  }

  function formatDisplay(estimate, chainId) {
    if (estimate?.live && estimate.feeUsd > 0) {
      const ethPart = estimate.feeEth ? ` · ${estimate.feeEth.toFixed(5)} ETH` : '';
      return `~${formatUsd(estimate.feeUsd)}${ethPart} (live)`;
    }
    const r = getRange(chainId);
    return `${formatUsd(r.low)}–${formatUsd(r.high)} typical`;
  }

  function renderCheckoutBlock({ poolUsd, checkoutEth, estimate, chainId }) {
    const r = getRange(chainId);
    const feeLine = formatDisplay(estimate, chainId);
    return `
      <div class="checkout-fee-breakdown">
        <div class="fee-line"><span>Prize pool (you pay)</span><strong>${formatUsd(poolUsd)} · ${checkoutEth} ETH</strong></div>
        <div class="fee-line fee-line-muted" id="networkFeeLine">
          <span>Blockchain network fee <span class="fee-tag">not NeonDraw</span></span>
          <span>${feeLine}</span>
        </div>
        <p class="fee-line-note">${COPY.lottery}</p>
        <p class="fee-line-note fee-line-note-muted">Fees on ${r.network} change with traffic — often less than the high end. ${COPY.short}</p>
      </div>`;
  }

  function renderDepositHint(estimate, chainId) {
    const feeLine = formatDisplay(estimate, chainId);
    return `Network fee (blockchain, not NeonDraw): ${feeLine}. ${COPY.deposit}`;
  }

  return {
    COPY,
    getRange,
    formatDisplay,
    renderCheckoutBlock,
    renderDepositHint,
  };
})();

window.NetworkFee = NetworkFee;
