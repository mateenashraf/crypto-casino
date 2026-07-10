/**
 * Commit-reveal draw transparency - public hashes stay visible;
 * full seed / verify tools require Fairness Pro ($20/mo), tied to a connected wallet.
 */
const ProvablyFair = (() => {
  const STORAGE = 'fair_draws';
  /** Map of walletAddress(lower) → { activeUntil, purchasedAt, priceUsd, txId } */
  const ACCESS_KEY = 'fairness_pro_wallets';
  const LEGACY_ACCESS_KEY = 'fairness_pro_access';
  const PRICE_USD = 20;

  function sha256Hex(input) {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = ((h << 5) - h) + input.charCodeAt(i);
      h |= 0;
    }
    return '0x' + Math.abs(h).toString(16).padStart(8, '0') + input.length.toString(16).padStart(8, '0');
  }

  async function hashString(str) {
    if (window.crypto?.subtle) {
      const buf = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return sha256Hex(str);
  }

  function loadDraws() {
    return SecureStorage.getJSON(STORAGE, []);
  }

  function saveDraws(list) {
    SecureStorage.setJSON(STORAGE, list.slice(0, 40));
  }

  function walletApi() {
    return window.SecureWeb3 || window.Wallet || null;
  }

  function connectedAddress() {
    const w = walletApi();
    if (!w?.isConnected?.()) return null;
    const addr = w.getAddress?.();
    return addr ? String(addr) : null;
  }

  function shortWallet(addr) {
    if (!addr || addr.length < 10) return addr || '';
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }

  function loadAccessMap() {
    // Drop legacy email/password entitlement if present
    if (SecureStorage.getJSON(LEGACY_ACCESS_KEY, null)) {
      SecureStorage.remove(LEGACY_ACCESS_KEY);
    }
    const raw = SecureStorage.getJSON(ACCESS_KEY, {});
    return raw && typeof raw === 'object' ? raw : {};
  }

  function saveAccessMap(map) {
    SecureStorage.setJSON(ACCESS_KEY, map);
  }

  function getAccessForWallet(addr) {
    if (!addr) return null;
    const key = addr.toLowerCase();
    const map = loadAccessMap();
    const raw = map[key];
    if (!raw?.activeUntil) return null;
    if (Date.now() > raw.activeUntil) {
      delete map[key];
      saveAccessMap(map);
      return null;
    }
    return { ...raw, wallet: addr };
  }

  function getAccess() {
    return getAccessForWallet(connectedAddress());
  }

  function hasProAccess() {
    return !!getAccess();
  }

  function grantProAccess(addr, meta = {}) {
    if (!addr) return null;
    const key = addr.toLowerCase();
    const map = loadAccessMap();
    const activeUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const record = {
      wallet: addr,
      activeUntil,
      purchasedAt: Date.now(),
      priceUsd: PRICE_USD,
      ...meta,
    };
    map[key] = record;
    saveAccessMap(map);
    return record;
  }

  function priceEth() {
    const eth = window.TicketPricing?.usdToEth?.(PRICE_USD);
    if (Number.isFinite(eth) && eth > 0) return eth;
    const rate = window.TicketPricing?.getEthUsd?.() || 3500;
    return parseFloat((PRICE_USD / rate).toFixed(6));
  }

  function casinoBalanceEth(addr) {
    return walletApi()?.getCasinoBalance?.(addr) || 0;
  }

  function formatUsd(n) {
    return window.TicketPricing?.formatUsd?.(n) || `$${n}`;
  }

  async function purchaseWithWallet() {
    const w = walletApi();
    if (!w?.isConnected?.()) {
      throw new Error('Connect your wallet first');
    }
    const addr = w.getAddress();
    if (!addr) throw new Error('Connect your wallet first');

    if (getAccessForWallet(addr)) {
      return getAccessForWallet(addr);
    }

    const costEth = priceEth();
    const bal = casinoBalanceEth(addr);
    if (bal < costEth) {
      const need = formatUsd(PRICE_USD);
      throw new Error(
        `Deposit at least ${need} to casino balance, then unlock Fairness Pro`
      );
    }

    w.setCasinoBalance?.(addr, bal - costEth);

    return grantProAccess(addr, { paidEth: costEth });
  }

  async function createDrawCommit(drawId, tierName) {
    const serverSeed = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    const clientSeed = `neondraw-${drawId}-${Date.now()}`;
    const nonce = Math.floor(Math.random() * 1_000_000);
    const commitHash = await hashString(`${serverSeed}:${clientSeed}:${nonce}`);

    const record = {
      drawId,
      tierName,
      commitHash,
      serverSeed,
      clientSeed,
      nonce,
      revealed: false,
      winningNumbers: null,
      createdAt: Date.now(),
    };
    const list = loadDraws();
    list.unshift(record);
    saveDraws(list);
    return record;
  }

  async function revealDraw(record, winningNumbers) {
    const verifyHash = await hashString(`${record.serverSeed}:${record.clientSeed}:${record.nonce}`);
    const list = loadDraws();
    const idx = list.findIndex((d) => d.commitHash === record.commitHash);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        revealed: true,
        winningNumbers,
        verified: verifyHash === record.commitHash,
        revealedAt: Date.now(),
      };
      saveDraws(list);
    }
    return verifyHash === record.commitHash;
  }

  function explainOutcome(won, context = 'lottery') {
    if (context === 'slot_paid' || context === 'slot_free') {
      return won
        ? 'Nice match! Each spin uses verified randomness. Past results do not change the next outcome.'
        : 'No match this time. Every spin is independent. Try again when you are ready.';
    }
    if (context === 'roulette' || context === 'roulette_free') {
      return won
        ? `${context === 'roulette_free' ? 'Free spin win! ' : ''}Your bet matched the winning pocket. Each wheel spin is independent - the ball has no memory.`
        : 'Ball landed elsewhere this spin. Every spin is a fresh outcome on a fair American wheel.';
    }
    return won
      ? 'Your numbers matched this draw. Prizes come from the published prize pool for that draw tier.'
      : 'No match this draw. Every scheduled draw uses a published commit hash.';
  }

  function modalWalletStateHtml() {
    const addr = connectedAddress();
    if (!addr) {
      return `
        <div class="fairness-pro-wallet-box">
          <p class="fairness-pro-wallet-label">No wallet connected</p>
          <p class="fairness-pro-wallet-hint">Connect the wallet you play with. Access stays on that address - reconnect anytime to use the tools.</p>
        </div>
      `;
    }
    const bal = casinoBalanceEth(addr);
    const cost = priceEth();
    const balUsd = window.TicketPricing?.ethToUsd?.(bal);
    const balLabel = Number.isFinite(balUsd)
      ? `${formatUsd(balUsd)} casino balance`
      : `${bal.toFixed(4)} ETH casino balance`;
    return `
      <div class="fairness-pro-wallet-box is-connected">
        <p class="fairness-pro-wallet-label">Paying from</p>
        <code class="fairness-pro-wallet-addr">${shortWallet(addr)}</code>
        <p class="fairness-pro-wallet-hint">${balLabel}${bal >= cost ? '' : ` · need ${formatUsd(PRICE_USD)}`}</p>
      </div>
    `;
  }

  function refreshModal() {
    const modal = document.getElementById('fairnessProModal');
    if (!modal || modal.hidden) return;
    const slot = modal.querySelector('[data-fair-wallet-slot]');
    if (slot) slot.innerHTML = modalWalletStateHtml();
    const btn = modal.querySelector('[data-fair-pay]');
    if (!btn) return;
    const addr = connectedAddress();
    if (!addr) {
      btn.textContent = 'Connect wallet to continue';
      btn.dataset.mode = 'connect';
    } else if (getAccessForWallet(addr)) {
      btn.textContent = 'Already unlocked - close';
      btn.dataset.mode = 'done';
    } else {
      const bal = casinoBalanceEth(addr);
      if (bal < priceEth()) {
        btn.textContent = `Deposit ${formatUsd(PRICE_USD)}+ then unlock`;
        btn.dataset.mode = 'deposit';
      } else {
        btn.textContent = `Pay ${formatUsd(PRICE_USD)} from casino balance`;
        btn.dataset.mode = 'pay';
      }
    }
  }

  function ensureModal() {
    if (document.getElementById('fairnessProModal')) return;
    const modal = document.createElement('div');
    modal.id = 'fairnessProModal';
    modal.className = 'fairness-pro-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="fairness-pro-backdrop" data-fair-close></div>
      <div class="fairness-pro-dialog" role="dialog" aria-labelledby="fairnessProTitle">
        <button type="button" class="fairness-pro-close" data-fair-close aria-label="Close">×</button>
        <p class="fairness-pro-eyebrow">Fairness Pro</p>
        <h3 id="fairnessProTitle">Unlock with your wallet</h3>
        <p class="fairness-pro-copy">
          Public commit hashes stay free. Full server seeds, nonce values, and the
          SHA-256 verify toolkit unlock for <strong>${formatUsd(PRICE_USD)}/month</strong>,
          paid from your connected wallet’s casino balance - no email or password.
        </p>
        <ul class="fairness-pro-perks">
          <li>Tied to your wallet address - reconnect to keep access</li>
          <li>Reveal complete seeds after each draw</li>
          <li>Run SHA-256 verify against the published hash</li>
        </ul>
        <div data-fair-wallet-slot></div>
        <p class="fairness-pro-price">${formatUsd(PRICE_USD)} · 30 days on this wallet · renew anytime</p>
        <button type="button" class="btn btn-gold btn-block" data-fair-pay>Pay ${formatUsd(PRICE_USD)} from casino balance</button>
        <p class="fairness-pro-fine">Switch wallets and Pro stays on the address that paid. Connect that wallet again to use the tools.</p>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('[data-fair-close]').forEach((el) => {
      el.addEventListener('click', () => closeModal());
    });

    modal.querySelector('[data-fair-pay]')?.addEventListener('click', async () => {
      const btn = modal.querySelector('[data-fair-pay]');
      const mode = btn?.dataset.mode || 'pay';
      try {
        if (mode === 'done') {
          closeModal();
          renderPanel();
          return;
        }
        if (mode === 'connect') {
          const w = walletApi();
          if (!w?.connect) throw new Error('Wallet unavailable');
          await w.connect();
          refreshModal();
          return;
        }
        if (mode === 'deposit') {
          closeModal();
          window.AppUI?.openWallet?.();
          window.AppUI?.toast?.(
            `Deposit at least ${formatUsd(PRICE_USD)} to casino balance, then return here`,
            'info'
          );
          return;
        }
        btn.disabled = true;
        await purchaseWithWallet();
        closeModal();
        window.AppUI?.toast?.(
          `Fairness Pro active for 30 days on ${shortWallet(connectedAddress())}`,
          'success'
        );
        renderPanel();
        window.dispatchEvent(new CustomEvent('balance-updated'));
      } catch (err) {
        window.AppUI?.toast?.(err.message || 'Could not unlock Fairness Pro', 'error');
        refreshModal();
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  function openModal() {
    ensureModal();
    const modal = document.getElementById('fairnessProModal');
    if (modal) modal.hidden = false;
    refreshModal();
  }

  function closeModal() {
    const modal = document.getElementById('fairnessProModal');
    if (modal) modal.hidden = true;
  }

  function renderLockedRecord(d) {
    return `
      <article class="fair-record fair-record-locked ${d.revealed ? 'revealed' : 'pending'}">
        <div class="fair-record-head">
          <strong>${d.tierName || d.drawId}</strong>
          <span class="fair-badge">Committed</span>
        </div>
        <div class="fair-hash"><span>Public hash</span><code>${d.commitHash.slice(0, 28)}…</code></div>
        ${d.revealed && d.winningNumbers
          ? `<div class="fair-numbers">Winning: ${d.winningNumbers.join(' · ')}</div>`
          : '<div class="fair-numbers muted">Numbers posted at draw close</div>'}
        <div class="fair-locked-panel">
          <div class="fair-locked-blur" aria-hidden="true">
            <div>serverSeed: ••••••••••••••••••••••••••••</div>
            <div>clientSeed: ••••••••••••••••••</div>
            <div>nonce: ••••••</div>
            <div>verify: SHA-256(seed:client:nonce) == hash</div>
          </div>
          <button type="button" class="btn btn-outline fair-unlock-btn" data-fair-unlock>
            Unlock with wallet · ${formatUsd(PRICE_USD)}/mo
          </button>
        </div>
      </article>
    `;
  }

  function renderOpenRecord(d) {
    return `
      <article class="fair-record ${d.revealed ? 'revealed' : 'pending'}">
        <div class="fair-record-head">
          <strong>${d.tierName || d.drawId}</strong>
          <span class="fair-badge">${d.revealed ? 'Verified' : 'Committed'}</span>
        </div>
        <div class="fair-hash"><span>Hash</span><code>${d.commitHash}</code></div>
        ${d.revealed && d.winningNumbers
          ? `<div class="fair-numbers">Winning: ${d.winningNumbers.join(' · ')}</div>`
          : '<div class="fair-numbers muted">Numbers revealed at draw close</div>'}
        ${d.revealed ? `
          <div class="fair-seed-block">
            <div><span>Server seed</span><code>${d.serverSeed}</code></div>
            <div><span>Client seed</span><code>${d.clientSeed}</code></div>
            <div><span>Nonce</span><code>${d.nonce}</code></div>
          </div>
          <div class="fair-verify">${d.verified ? '✓ Seed matches commit' : 'Pending chain anchor'}</div>
        ` : ''}
      </article>
    `;
  }

  function renderPanel() {
    const el = document.getElementById('provablyFairPanel');
    if (!el) return;
    const addr = connectedAddress();
    const access = getAccess();
    const pro = !!access;
    const draws = loadDraws().slice(0, 6);

    const gate = `
      <div class="fairness-pro-banner ${pro ? 'is-active' : ''}">
        ${pro ? `
          <div>
            <strong>Fairness Pro active</strong>
            <span>Full seeds &amp; verify unlocked · ${shortWallet(addr)} · through ${new Date(access.activeUntil).toLocaleDateString()}</span>
          </div>
        ` : `
          <div>
            <strong>Public hashes are free</strong>
            <span>Full seed reveal &amp; verify toolkit - connect wallet &amp; pay ${formatUsd(PRICE_USD)}/month</span>
          </div>
          <button type="button" class="btn btn-gold" data-fair-unlock>Get Fairness Pro</button>
        `}
      </div>
    `;

    if (!draws.length) {
      el.innerHTML = `${gate}<p class="panel-hint">Draw commit hashes appear here after each scheduled draw closes. Anyone can see the hash; full verification tools unlock when your subscribed wallet is connected.</p>`;
      bindUnlock(el);
      return;
    }

    el.innerHTML = gate + draws.map((d) => (pro ? renderOpenRecord(d) : renderLockedRecord(d))).join('');
    bindUnlock(el);
  }

  function bindUnlock(root) {
    root.querySelectorAll('[data-fair-unlock]').forEach((btn) => {
      btn.addEventListener('click', () => openModal());
    });
  }

  function init() {
    ensureModal();
    renderPanel();
    window.addEventListener('draw-completed', async (e) => {
      const w = e.detail;
      const record = await createDrawCommit(w.drawId, w.drawName);
      await revealDraw(record, w.numbers);
      renderPanel();
    });
    walletApi()?.on?.((event) => {
      if (event === 'connected' || event === 'disconnected' || event === 'deposit-success') {
        renderPanel();
        refreshModal();
      }
    });
  }

  return {
    init,
    renderPanel,
    explainOutcome,
    createDrawCommit,
    revealDraw,
    getRecords: loadDraws,
    hasProAccess,
    openModal,
    purchaseWithWallet,
  };
})();

window.ProvablyFair = ProvablyFair;
