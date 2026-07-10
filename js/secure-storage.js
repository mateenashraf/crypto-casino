/**
 * Sealed browser storage: values are MAC-signed; tampered localStorage is rejected.
 * Note: a determined attacker who reverse-engineers the page can still forge seals.
 * This stops casual DevTools balance edits; real money needs a server ledger.
 */
const SecureStorage = (() => {
  const PREFIX = '_nd8_';
  const SITE_SALT = 'nd2026x';
  const SEAL_VERSION = 2;

  /** Split key material (joined at runtime) raises the bar vs plain base64 */
  const KM = [
    'n3on', 'Dr4w', '7kQ2', 'mXp9', 'L0cK', 's3al', '9fA1', 'Hv4e',
  ];

  const LOGICAL_TO_PHYSICAL = {
    balances: 'a7f2',
    transactions: 'b3c9',
    tickets: 'c1e4',
    pool: 'd8a1',
    free_tickets: 'e2b7',
    slot_history: 'f4c3',
    slot_free_daily: 'g9d2',
    roulette_history: 'h1e8',
    roulette_free_daily: 'i6f0',
    draw_state: 'j3a5',
    draw_winners: 'k7b2',
    tickets_by_draw: 'l2c9',
    economics: 'm8d1',
    pending_payouts: 'n4e6',
    approved_payouts: 'o1f3',
    live_pool: 'p9a7',
    provably_fair: 'q5b8',
    fair_draws: 'q6c1',
    live_pool_count: 'u3f7',
    slot_pending_free: 'r2c4',
    dev_unlimited: 's8d0',
    dev_ticket_grant: 't1e9',
  };

  /** Money / entitlement keys: unsealed or bad MAC → wiped */
  const SENSITIVE = new Set([
    'balances',
    'transactions',
    'tickets',
    'free_tickets',
    'pool',
    'slot_free_daily',
    'roulette_free_daily',
    'pending_payouts',
    'approved_payouts',
    'tickets_by_draw',
    'economics',
  ]);

  const LEGACY_KEYS = {
    starbitz_balances: 'balances',
    starbitz_transactions: 'transactions',
    starbitz_lottery_tickets: 'tickets',
    starbitz_pool_contributions: 'pool',
    starbitz_free_tickets: 'free_tickets',
    starbitz_slot_history: 'slot_history',
    starbitz_free_spins_daily: 'slot_free_daily',
    starbitz_roulette_history: 'roulette_history',
    starbitz_roulette_free_daily: 'roulette_free_daily',
    starbitz_draw_state: 'draw_state',
    starbitz_draw_winners: 'draw_winners',
    starbitz_tickets_by_draw: 'tickets_by_draw',
    starbitz_economics_state: 'economics',
    starbitz_pending_payouts: 'pending_payouts',
    starbitz_approved_payouts: 'approved_payouts',
    starbitz_live_pool: 'live_pool',
    starbitz_provably_fair: 'provably_fair',
    starbitz_fair_draws: 'fair_draws',
    starbitz_live_pool_count: 'live_pool_count',
    neondraw_pending_free_ticket: 'slot_pending_free',
    neondraw_dev_unlimited_spins: 'dev_unlimited',
    neondraw_dev_free_ticket_grant: 'dev_ticket_grant',
    starbitz_contact_messages: null,
  };

  const memory = new Map();
  let tamperCount = 0;

  function physicalKey(logical) {
    const slug = LOGICAL_TO_PHYSICAL[logical] || logical.slice(0, 8);
    return `${PREFIX}${slug}`;
  }

  function sealKey() {
    return `${KM.join('')}|${SITE_SALT}|${location.origin || 'nd'}`;
  }

  /* --- compact sync SHA-256 / HMAC (public domain style) --- */
  function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }

  function sha256(ascii) {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    const bytes = typeof ascii === 'string'
      ? new TextEncoder().encode(ascii)
      : ascii;
    const bitLen = bytes.length * 8;
    const withPad = new Uint8Array(((bytes.length + 9 + 63) & ~63));
    withPad.set(bytes);
    withPad[bytes.length] = 0x80;
    const view = new DataView(withPad.buffer);
    view.setUint32(withPad.length - 4, bitLen >>> 0);
    view.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000));

    let h0 = 0x6a09e667; let h1 = 0xbb67ae85; let h2 = 0x3c6ef372; let h3 = 0xa54ff53a;
    let h4 = 0x510e527f; let h5 = 0x9b05688c; let h6 = 0x1f83d9ab; let h7 = 0x5be0cd19;
    const w = new Uint32Array(64);

    for (let i = 0; i < withPad.length; i += 64) {
      for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4);
      for (let j = 16; j < 64; j++) {
        const s0 = rotr(7, w[j - 15]) ^ rotr(18, w[j - 15]) ^ (w[j - 15] >>> 3);
        const s1 = rotr(17, w[j - 2]) ^ rotr(19, w[j - 2]) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }
      let a = h0; let b = h1; let c = h2; let d = h3;
      let e = h4; let f = h5; let g = h6; let h = h7;
      for (let j = 0; j < 64; j++) {
        const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
        const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7]
      .map((x) => x.toString(16).padStart(8, '0'))
      .join('');
  }

  function hmac(message) {
    const key = sealKey();
    const block = 64;
    const keyBytes = new TextEncoder().encode(key);
    const k = new Uint8Array(block);
    if (keyBytes.length > block) {
      const hashed = sha256(key);
      for (let i = 0; i < 32; i++) k[i] = parseInt(hashed.slice(i * 2, i * 2 + 2), 16);
    } else {
      k.set(keyBytes);
    }
    const oKey = new Uint8Array(block);
    const iKey = new Uint8Array(block);
    for (let i = 0; i < block; i++) {
      oKey[i] = k[i] ^ 0x5c;
      iKey[i] = k[i] ^ 0x36;
    }
    const inner = new Uint8Array(block + new TextEncoder().encode(message).length);
    inner.set(iKey);
    inner.set(new TextEncoder().encode(message), block);
    const innerHashHex = sha256(inner);
    const innerHash = new Uint8Array(32);
    for (let i = 0; i < 32; i++) innerHash[i] = parseInt(innerHashHex.slice(i * 2, i * 2 + 2), 16);
    const outer = new Uint8Array(block + 32);
    outer.set(oKey);
    outer.set(innerHash, block);
    return sha256(outer);
  }

  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  function b64decode(encoded) {
    const bin = atob(encoded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function reportTamper(logical) {
    tamperCount += 1;
    try {
      window.dispatchEvent(new CustomEvent('nd-storage-tamper', { detail: { key: logical } }));
    } catch { /* */ }
    if (SENSITIVE.has(logical)) {
      try {
        window.AppUI?.toast?.('Saved data looked altered and was reset for safety.', 'error');
      } catch { /* */ }
    }
  }

  function seal(logical, raw) {
    const payload = String(raw);
    const ts = Date.now();
    const mac = hmac(`${SEAL_VERSION}|${logical}|${ts}|${payload}`);
    return b64encode(JSON.stringify({ v: SEAL_VERSION, k: logical, t: ts, p: payload, m: mac }));
  }

  function unseal(logical, encoded) {
    if (!encoded) return null;
    try {
      const text = b64decode(encoded);
      // Sealed envelope
      if (text.startsWith('{')) {
        const env = JSON.parse(text);
        if (!env || env.v !== SEAL_VERSION || env.k !== logical || typeof env.p !== 'string' || typeof env.m !== 'string') {
          reportTamper(logical);
          return null;
        }
        const expect = hmac(`${SEAL_VERSION}|${logical}|${env.t}|${env.p}`);
        if (expect !== env.m) {
          reportTamper(logical);
          return null;
        }
        // Reject absurd future timestamps / ancient seals reused oddly
        if (typeof env.t !== 'number' || env.t > Date.now() + 60_000) {
          reportTamper(logical);
          return null;
        }
        return env.p;
      }
      // Legacy salt:payload base64: sensitive keys rejected; others migrate
      const legacyPrefix = `${SITE_SALT}:`;
      if (text.startsWith(legacyPrefix)) {
        if (SENSITIVE.has(logical)) {
          reportTamper(logical);
          return null;
        }
        return text.slice(legacyPrefix.length);
      }
      reportTamper(logical);
      return null;
    } catch {
      reportTamper(logical);
      return null;
    }
  }

  function getRaw(logical) {
    if (memory.has(logical)) return memory.get(logical);
    const phys = physicalKey(logical);
    const sealed = localStorage.getItem(phys);
    const raw = unseal(logical, sealed);
    if (raw == null) {
      if (sealed != null && SENSITIVE.has(logical)) {
        localStorage.removeItem(phys);
      }
      return null;
    }
    memory.set(logical, raw);
    // Upgrade legacy non-sensitive to sealed form
    try {
      if (sealed && !b64decode(sealed).startsWith('{')) {
        localStorage.setItem(phys, seal(logical, raw));
      }
    } catch { /* */ }
    return raw;
  }

  function setRaw(logical, raw) {
    if (raw == null) {
      memory.delete(logical);
      localStorage.removeItem(physicalKey(logical));
      return;
    }
    const str = String(raw);
    memory.set(logical, str);
    try {
      localStorage.setItem(physicalKey(logical), seal(logical, str));
    } catch { /* quota */ }
  }

  function getJSON(logical, fallback = null) {
    const raw = getRaw(logical);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      if (SENSITIVE.has(logical)) {
        reportTamper(logical);
        remove(logical);
      }
      return fallback;
    }
  }

  function setJSON(logical, value) {
    setRaw(logical, JSON.stringify(value));
  }

  function remove(logical) {
    memory.delete(logical);
    localStorage.removeItem(physicalKey(logical));
  }

  function migrateLegacy() {
    Object.entries(LEGACY_KEYS).forEach(([legacy, logical]) => {
      const legacyVal = localStorage.getItem(legacy);
      if (legacyVal == null) return;
      if (logical && !SENSITIVE.has(logical)) {
        const existing = getRaw(logical);
        if (existing == null) setRaw(logical, legacyVal);
      }
      localStorage.removeItem(legacy);
    });
    localStorage.removeItem('starbitz_contact_messages');
    localStorage.removeItem('starbitz_live_pool_count');
  }

  function reverifySensitive() {
    SENSITIVE.forEach((logical) => {
      memory.delete(logical);
      const sealed = localStorage.getItem(physicalKey(logical));
      if (!sealed) return;
      const raw = unseal(logical, sealed);
      if (raw == null) {
        localStorage.removeItem(physicalKey(logical));
      } else {
        memory.set(logical, raw);
      }
    });
  }

  function watchStorage() {
    window.addEventListener('storage', (e) => {
      if (!e.key || !e.key.startsWith(PREFIX)) return;
      memory.clear();
      reverifySensitive();
    });
    // Same-tab DevTools edits don't fire `storage`; poll lightly
    setInterval(() => {
      SENSITIVE.forEach((logical) => {
        const phys = physicalKey(logical);
        const disk = localStorage.getItem(phys);
        const mem = memory.get(logical);
        if (mem == null && disk == null) return;
        if (mem != null && disk == null) {
          reportTamper(logical);
          memory.delete(logical);
          return;
        }
        if (disk != null) {
          const raw = unseal(logical, disk);
          if (raw == null) {
            localStorage.removeItem(phys);
            memory.delete(logical);
            return;
          }
          if (mem != null && raw !== mem) {
            // Disk changed under us without going through setRaw
            reportTamper(logical);
            localStorage.removeItem(phys);
            memory.delete(logical);
          }
        }
      });
    }, 2500);
  }

  migrateLegacy();
  watchStorage();

  const api = {
    getJSON,
    setJSON,
    getRaw,
    setRaw,
    remove,
    key: physicalKey,
    migrateLegacy,
    reverifySensitive,
    isSensitive: (logical) => SENSITIVE.has(logical),
    getTamperCount: () => tamperCount,
  };

  return Object.freeze(api);
})();

Object.defineProperty(window, 'SecureStorage', {
  value: SecureStorage,
  writable: false,
  configurable: false,
});
