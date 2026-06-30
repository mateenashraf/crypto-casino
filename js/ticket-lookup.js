/**
 * Wallet address ticket lookup — purchase history with on-chain links
 */
const TicketLookup = (() => {
  const wallet = () => window.SecureWeb3;

  function formatUsd(n) {
    return `$${parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function renderNumberBalls(numbers) {
    return numbers.map((n) => `<span class="lookup-ball">${n}</span>`).join('');
  }

  function groupByTx(tickets) {
    const groups = new Map();
    tickets.forEach((t) => {
      const key = t.hash || t.id;
      if (!groups.has(key)) {
        groups.set(key, {
          hash: t.hash,
          chainId: t.chainId || wallet().getChainId() || 11155111,
          timestamp: t.timestamp,
          tickets: [],
        });
      }
      const g = groups.get(key);
      g.tickets.push(t);
      if (t.timestamp < g.timestamp) g.timestamp = t.timestamp;
    });
    return [...groups.values()].sort((a, b) => b.timestamp - a.timestamp);
  }

  function renderSummary(addr, tickets) {
    const totalUsd = tickets.reduce((s, t) => s + (t.usdPrice || 0), 0);
    const totalEth = tickets.reduce((s, t) => s + (t.amountEth || 0), 0);
    const chainId = tickets[0]?.chainId || wallet().getChainId() || 11155111;
    const chainName = wallet().getConfig().CHAIN_NAMES[chainId] || `Chain ${chainId}`;
    const addrUrl = wallet().getExplorerAddressUrl(addr, chainId);

    return `
      <div class="lookup-summary">
        <div class="lookup-summary-main">
          <span class="lookup-summary-count">${tickets.length}</span>
          <span class="lookup-summary-label">ticket${tickets.length === 1 ? '' : 's'} found</span>
        </div>
        <div class="lookup-summary-stats">
          <div class="lookup-stat">
            <span class="lookup-stat-label">Total spent</span>
            <strong>${formatUsd(totalUsd)}</strong>
          </div>
          <div class="lookup-stat">
            <span class="lookup-stat-label">On-chain</span>
            <strong>${totalEth.toFixed(4)} ETH</strong>
          </div>
          <div class="lookup-stat">
            <span class="lookup-stat-label">Network</span>
            <strong>${chainName}</strong>
          </div>
        </div>
        <a href="${addrUrl}" target="_blank" rel="noopener noreferrer" class="lookup-address-link">
          <span data-icon="external-link" data-icon-size="14"></span>
          View wallet on block explorer
        </a>
      </div>`;
  }

  function renderTxGroup(group) {
    const w = wallet();
    const txUrl = group.hash ? w.getExplorerTxUrl(group.hash, group.chainId) : null;
    const txUsd = group.tickets.reduce((s, t) => s + (t.usdPrice || 0), 0);
    const txEth = group.tickets.reduce((s, t) => s + (t.amountEth || 0), 0);
    const shortHash = group.hash ? `${group.hash.slice(0, 10)}…${group.hash.slice(-8)}` : '—';

    const ticketRows = group.tickets.map((t) => `
      <div class="lookup-ticket-row">
        <div class="lookup-ticket-id">${t.id}</div>
        <div class="lookup-ticket-numbers">${renderNumberBalls(t.numbers)}</div>
        <div class="lookup-ticket-price">${formatUsd(t.usdPrice)}</div>
        ${t.bundleIndex ? `<span class="lookup-bundle-tag">${t.bundleIndex}/${t.bundleTotal}</span>` : ''}
      </div>
    `).join('');

    return `
      <article class="lookup-tx-card">
        <header class="lookup-tx-header">
          <div class="lookup-tx-meta">
            <time>${formatDate(group.timestamp)}</time>
            <span class="lookup-tx-qty">${group.tickets.length} ticket${group.tickets.length === 1 ? '' : 's'}</span>
            <span class="lookup-tx-total">${formatUsd(txUsd)} · ${txEth.toFixed(4)} ETH</span>
          </div>
          ${txUrl ? `
            <a href="${txUrl}" target="_blank" rel="noopener noreferrer" class="lookup-tx-link" title="${group.hash}">
              <span data-icon="link-2" data-icon-size="14"></span>
              ${shortHash}
            </a>` : ''}
        </header>
        <div class="lookup-ticket-list">${ticketRows}</div>
      </article>`;
  }

  function renderResults(addr) {
    const resultsEl = document.getElementById('ticketLookupResults');
    if (!resultsEl) return;

    const tickets = wallet().getTicketsByAddress(addr);

    if (!tickets.length) {
      resultsEl.innerHTML = `
        <div class="lookup-empty">
          <span class="lookup-empty-icon" data-icon="search-x" data-icon-size="32"></span>
          <p>No lottery tickets found for this address on this device.</p>
          <p class="lookup-empty-hint">Purchases made here are stored locally and linked to on-chain transactions.</p>
        </div>`;
      window.Icons?.hydrate(resultsEl);
      return;
    }

    const groups = groupByTx(tickets);
    resultsEl.innerHTML = `
      ${renderSummary(addr, tickets)}
      <div class="lookup-tx-list">${groups.map(renderTxGroup).join('')}</div>`;
    window.Icons?.hydrate(resultsEl);
  }

  function showError(message) {
    const resultsEl = document.getElementById('ticketLookupResults');
    if (!resultsEl) return;
    resultsEl.innerHTML = `<div class="lookup-error">${message}</div>`;
  }

  function search(addrInput) {
    const raw = (addrInput ?? document.getElementById('ticketLookupInput')?.value ?? '').trim();
    if (!raw) {
      showError('Enter a wallet address to search.');
      return;
    }
    if (!wallet().isValidAddress(raw)) {
      showError('Invalid Ethereum address. Check the format and try again.');
      return;
    }
    const addr = wallet().normalizeAddress(raw);
    renderResults(addr);
    const input = document.getElementById('ticketLookupInput');
    if (input) input.value = addr;
  }

  function useConnectedWallet() {
    if (!wallet().isConnected()) {
      window.AppUI?.toast('Connect your wallet first', 'info');
      window.AppUI?.openWallet?.();
      return;
    }
    const addr = wallet().getAddress();
    const input = document.getElementById('ticketLookupInput');
    if (input) input.value = addr;
    search(addr);
  }

  function init() {
    const form = document.getElementById('ticketLookupForm');
    const useBtn = document.getElementById('ticketLookupUseConnected');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      search();
    });

    useBtn?.addEventListener('click', useConnectedWallet);

    if (window.location.hash === '#ticket-lookup' && wallet().isConnected()) {
      useConnectedWallet();
    }
  }

  return { init, search, useConnectedWallet };
})();

window.TicketLookup = TicketLookup;
