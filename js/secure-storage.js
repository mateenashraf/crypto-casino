/**
 * Opaque browser storage — no readable keys or plaintext PII in localStorage.
 */
const SecureStorage = (() => {
  const PREFIX = '_nd8_';
  const SITE_SALT = 'nd2026x';

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

  function physicalKey(logical) {
    const slug = LOGICAL_TO_PHYSICAL[logical] || logical.slice(0, 8);
    return `${PREFIX}${slug}`;
  }

  function encode(raw) {
    if (raw == null) return '';
    const bytes = new TextEncoder().encode(`${SITE_SALT}:${raw}`);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  function decode(encoded) {
    if (!encoded) return null;
    try {
      const bin = atob(encoded);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const text = new TextDecoder().decode(bytes);
      const prefix = `${SITE_SALT}:`;
      if (!text.startsWith(prefix)) return null;
      return text.slice(prefix.length);
    } catch {
      return null;
    }
  }

  function getRaw(logical) {
    return decode(localStorage.getItem(physicalKey(logical)));
  }

  function setRaw(logical, raw) {
    if (raw == null) {
      localStorage.removeItem(physicalKey(logical));
      return;
    }
    localStorage.setItem(physicalKey(logical), encode(String(raw)));
  }

  function getJSON(logical, fallback = null) {
    const raw = getRaw(logical);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function setJSON(logical, value) {
    setRaw(logical, JSON.stringify(value));
  }

  function remove(logical) {
    localStorage.removeItem(physicalKey(logical));
  }

  function migrateLegacy() {
    Object.entries(LEGACY_KEYS).forEach(([legacy, logical]) => {
      const legacyVal = localStorage.getItem(legacy);
      if (legacyVal == null) return;
      if (logical) {
        const existing = getRaw(logical);
        if (existing == null) setRaw(logical, legacyVal);
      }
      localStorage.removeItem(legacy);
    });
    localStorage.removeItem('starbitz_contact_messages');
    localStorage.removeItem('starbitz_live_pool_count');
  }

  migrateLegacy();

  return {
    getJSON,
    setJSON,
    getRaw,
    setRaw,
    remove,
    key: physicalKey,
    migrateLegacy,
  };
})();

window.SecureStorage = SecureStorage;
