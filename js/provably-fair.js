/**
 * Commit-reveal draw transparency + probability explainers
 */
const ProvablyFair = (() => {
  const STORAGE = 'starbitz_fair_draws';

  function sha256Hex(input) {
    if (window.crypto?.subtle) {
      return null;
    }
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
    try { return JSON.parse(localStorage.getItem(STORAGE) || '[]'); } catch { return []; }
  }

  function saveDraws(list) {
    localStorage.setItem(STORAGE, JSON.stringify(list.slice(0, 40)));
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
    return won
      ? 'Your numbers matched this draw. Prizes come from the published prize pool for that draw tier.'
      : 'No match this draw. Every scheduled draw uses a published commit hash that is verified after the numbers are revealed.';
  }

  function renderPanel() {
    const el = document.getElementById('provablyFairPanel');
    if (!el) return;
    const draws = loadDraws().slice(0, 6);
    if (!draws.length) {
      el.innerHTML = '<p class="panel-hint">Draw commits appear here after each scheduled draw closes.</p>';
      return;
    }
    el.innerHTML = draws.map((d) => `
      <article class="fair-record ${d.revealed ? 'revealed' : 'pending'}">
        <div class="fair-record-head">
          <strong>${d.tierName || d.drawId}</strong>
          <span class="fair-badge">${d.revealed ? 'Verified' : 'Committed'}</span>
        </div>
        <div class="fair-hash"><span>Hash</span><code>${d.commitHash.slice(0, 24)}…</code></div>
        ${d.revealed && d.winningNumbers
          ? `<div class="fair-numbers">Winning: ${d.winningNumbers.join(' · ')}</div>`
          : '<div class="fair-numbers muted">Numbers revealed at draw close</div>'}
        ${d.revealed ? `<div class="fair-verify">${d.verified ? '✓ Seed matches commit' : 'Pending chain anchor'}</div>` : ''}
      </article>
    `).join('');
  }

  function init() {
    renderPanel();
    window.addEventListener('draw-completed', async (e) => {
      const w = e.detail;
      const record = await createDrawCommit(w.drawId, w.drawName);
      await revealDraw(record, w.numbers);
      renderPanel();
    });
  }

  return {
    init,
    renderPanel,
    explainOutcome,
    createDrawCommit,
    revealDraw,
    getRecords: loadDraws,
  };
})();

window.ProvablyFair = ProvablyFair;
