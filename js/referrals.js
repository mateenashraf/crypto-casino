/**
 * Wallet referral invites: share a link, earn free ticket + casino free plays
 * when a new wallet connects through your invite.
 */
const Referrals = (() => {
  const PENDING_KEY = 'nd_pending_ref';
  const APPLIED_KEY = 'referral_applied';
  const PARAM = 'ref';
  const REWARD = { freeTickets: 1, slotSpins: 2, rouletteSpins: 2 };

  function apiBase() {
    return window.__ND_CFG__?.apiBase || '';
  }

  function normalizeAddr(addr) {
    if (!addr || typeof addr !== 'string') return '';
    try {
      return (window.ethers?.getAddress?.(addr) || addr).toLowerCase();
    } catch {
      return addr.toLowerCase();
    }
  }

  function codeForWallet(addr) {
    const key = normalizeAddr(addr).replace(/^0x/, '');
    if (key.length < 8) return '';
    return key.slice(0, 10);
  }

  function registerCode(addr) {
    const wallet = normalizeAddr(addr);
    const code = codeForWallet(wallet);
    if (!wallet || !code) return '';
    const codes = SecureStorage.getJSON('referral_codes', {});
    codes[code] = wallet;
    SecureStorage.setJSON('referral_codes', codes);
    return code;
  }

  function resolveCode(code) {
    if (!code || typeof code !== 'string') return '';
    const cleaned = code.trim().toLowerCase().replace(/^0x/, '');
    if (!cleaned) return '';
    if (/^[a-f0-9]{40}$/.test(cleaned)) {
      return normalizeAddr(`0x${cleaned}`);
    }
    const codes = SecureStorage.getJSON('referral_codes', {});
    if (codes[cleaned]) return codes[cleaned];
    const hit = Object.entries(codes).find(([c]) => c === cleaned || c.startsWith(cleaned));
    return hit ? hit[1] : '';
  }

  function captureFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get(PARAM);
      if (!ref) return null;
      const cleaned = ref.trim().toLowerCase().replace(/^0x/, '');
      if (cleaned.length < 8) return null;
      sessionStorage.setItem(PENDING_KEY, cleaned);
      params.delete(PARAM);
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash || ''}`;
      window.history.replaceState({}, '', next);
      return cleaned;
    } catch {
      return null;
    }
  }

  function getPendingCode() {
    try {
      return sessionStorage.getItem(PENDING_KEY) || '';
    } catch {
      return '';
    }
  }

  function clearPending() {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
  }

  function getApplied() {
    return SecureStorage.getJSON(APPLIED_KEY, {});
  }

  function markApplied(id) {
    if (!id) return;
    const map = getApplied();
    map[id] = Date.now();
    SecureStorage.setJSON(APPLIED_KEY, map);
  }

  function isApplied(id) {
    return Boolean(getApplied()[id]);
  }

  function getBonus(addr) {
    const key = normalizeAddr(addr);
    if (!key) return { slots: 0, roulette: 0 };
    const map = SecureStorage.getJSON('referral_bonus', {});
    const cur = map[key] || {};
    return {
      slots: Math.max(0, parseInt(cur.slots || 0, 10) || 0),
      roulette: Math.max(0, parseInt(cur.roulette || 0, 10) || 0),
    };
  }

  function setBonus(addr, next) {
    const key = normalizeAddr(addr);
    if (!key) return;
    const map = SecureStorage.getJSON('referral_bonus', {});
    map[key] = {
      slots: Math.max(0, next.slots | 0),
      roulette: Math.max(0, next.roulette | 0),
    };
    SecureStorage.setJSON('referral_bonus', map);
  }

  function grantBonus(addr, { slots = 0, roulette = 0 } = {}) {
    const cur = getBonus(addr);
    setBonus(addr, {
      slots: cur.slots + Math.max(0, slots),
      roulette: cur.roulette + Math.max(0, roulette),
    });
    return getBonus(addr);
  }

  function consumeBonusSpin(addr, kind) {
    const cur = getBonus(addr);
    if (kind === 'slots') {
      if (cur.slots <= 0) return false;
      setBonus(addr, { ...cur, slots: cur.slots - 1 });
      return true;
    }
    if (kind === 'roulette') {
      if (cur.roulette <= 0) return false;
      setBonus(addr, { ...cur, roulette: cur.roulette - 1 });
      return true;
    }
    return false;
  }

  function getStats(addr) {
    const key = normalizeAddr(addr);
    const map = SecureStorage.getJSON('referral_stats', {});
    const cur = map[key] || {};
    return {
      invited: Math.max(0, parseInt(cur.invited || 0, 10) || 0),
      rewarded: Math.max(0, parseInt(cur.rewarded || 0, 10) || 0),
    };
  }

  function bumpStats(addr, field, by = 1) {
    const key = normalizeAddr(addr);
    if (!key) return;
    const map = SecureStorage.getJSON('referral_stats', {});
    const cur = map[key] || { invited: 0, rewarded: 0 };
    cur[field] = (parseInt(cur[field] || 0, 10) || 0) + by;
    map[key] = cur;
    SecureStorage.setJSON('referral_stats', map);
  }

  function getShareLink(addr) {
    const wallet = normalizeAddr(addr);
    if (!wallet) return '';
    registerCode(wallet);
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set(PARAM, wallet.replace(/^0x/, ''));
    return url.toString();
  }

  function alreadyAttributed(referred) {
    const key = normalizeAddr(referred);
    const map = SecureStorage.getJSON('referral_attributions', {});
    return Boolean(map[key]);
  }

  function applyReward(referrer, reward, rewardId, referred) {
    if (isApplied(rewardId)) return false;
    const r = reward || REWARD;
    window.SecureWeb3?.grantFreeTickets?.(referrer, r.freeTickets || REWARD.freeTickets, {
      source: 'referral',
      referred,
      rewardId,
    });
    grantBonus(referrer, {
      slots: r.slotSpins || REWARD.slotSpins,
      roulette: r.rouletteSpins || REWARD.rouletteSpins,
    });
    markApplied(rewardId);
    bumpStats(referrer, 'invited');
    bumpStats(referrer, 'rewarded');
    return true;
  }

  async function postClaim(referred, referrer) {
    try {
      const res = await fetch(`${apiBase()}/api/live/referrals/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ referred, referrer }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  async function fetchPending(wallet) {
    try {
      const res = await fetch(
        `${apiBase()}/api/live/referrals/pending?wallet=${encodeURIComponent(wallet)}`,
        { headers: { Accept: 'application/json' }, cache: 'no-store' }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.rewards) ? data.rewards : [];
    } catch {
      return [];
    }
  }

  async function ackPending(wallet, ids) {
    if (!ids.length) return;
    try {
      await fetch(`${apiBase()}/api/live/referrals/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ wallet, ids }),
      });
    } catch {
      /* ignore */
    }
  }

  function creditLocally(referrer, referred, rewardId, reward) {
    const attributions = SecureStorage.getJSON('referral_attributions', {});
    attributions[normalizeAddr(referred)] = {
      referrer: normalizeAddr(referrer),
      at: Date.now(),
      rewardId,
      reward: { ...(reward || REWARD) },
    };
    SecureStorage.setJSON('referral_attributions', attributions);
    return applyReward(referrer, reward || REWARD, rewardId, referred);
  }

  /**
   * Invitee connected: attribute once, notify shared ledger, credit referrer on this device.
   */
  async function processPendingForWallet(newWallet) {
    const pending = getPendingCode();
    if (!pending) return { ok: false, reason: 'none' };

    const referred = normalizeAddr(newWallet);
    if (!referred) return { ok: false, reason: 'no_wallet' };

    registerCode(referred);

    if (alreadyAttributed(referred)) {
      clearPending();
      return { ok: false, reason: 'already' };
    }

    const referrer = resolveCode(pending);
    if (!referrer) {
      clearPending();
      return { ok: false, reason: 'unknown_code' };
    }
    if (referrer === referred) {
      clearPending();
      return { ok: false, reason: 'self' };
    }

    const rewardId = `ref-${referred}`;
    const server = await postClaim(referred, referrer);
    const reward = server?.reward || REWARD;

    // Always credit on this browser so same-device wallet switches see rewards immediately
    creditLocally(referrer, referred, rewardId, reward);
    clearPending();

    window.dispatchEvent(new CustomEvent('referral-credited', {
      detail: { referrer, referred, reward, rewardId },
    }));

    return { ok: true, referrer, reward };
  }

  /**
   * Referrer connected: pull any rewards earned from other devices via the live API.
   */
  async function pullRewardsForWallet(wallet) {
    const addr = normalizeAddr(wallet);
    if (!addr) return 0;
    const pending = await fetchPending(addr);
    const appliedIds = [];
    let n = 0;
    pending.forEach((item) => {
      if (!item?.id || isApplied(item.id)) {
        if (item?.id) appliedIds.push(item.id);
        return;
      }
      if (applyReward(addr, item.reward, item.id, item.referred)) {
        n += 1;
        appliedIds.push(item.id);
      }
    });
    await ackPending(addr, appliedIds);
    if (n > 0) {
      window.dispatchEvent(new CustomEvent('referral-rewards-claimed', {
        detail: { wallet: addr, count: n },
      }));
      window.AppUI?.toast?.(
        `Referral rewards unlocked: ${n} friend${n === 1 ? '' : 's'} joined. Free ticket + spins added.`,
        'success'
      );
      window.PlayerDashboard?.refresh?.();
      window.SlotMachine?.updateFreeUI?.();
      window.Roulette?.updateFreeUI?.();
      window.LotteryApp?.updateFreeTicketUI?.();
    }
    return n;
  }

  function updateShowcase() {
    const btn = document.getElementById('inviteGetLinkBtn');
    const hint = document.getElementById('inviteActionHint');
    if (!btn) return;
    const connected = Boolean(window.SecureWeb3?.isConnected?.() && window.SecureWeb3?.getAddress?.());
    if (connected) {
      btn.textContent = 'Open my invite link';
      if (hint) hint.textContent = 'Connected · copy your link from the dashboard';
    } else {
      btn.textContent = 'Get my invite link';
      if (hint) hint.textContent = 'Connect wallet · your link appears in the dashboard';
    }
  }

  function goToInviteLink() {
    const addr = window.SecureWeb3?.getAddress?.();
    if (!addr || !window.SecureWeb3?.isConnected?.()) {
      window.AppUI?.openWallet?.();
      window.AppUI?.toast?.('Connect your wallet to unlock your personal invite link', 'info');
      return;
    }
    const dash = document.getElementById('dashboard');
    dash?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    window.PlayerDashboard?.refresh?.();
    setTimeout(() => {
      const input = document.getElementById('dashRefLink');
      input?.focus?.();
      input?.select?.();
    }, 350);
  }

  function init() {
    const captured = captureFromUrl();
    if (captured) {
      window.AppUI?.toast?.(
        'Invite link saved. Connect your wallet to play. Your friend earns free rewards when you join.',
        'info'
      );
    }

    document.getElementById('inviteGetLinkBtn')?.addEventListener('click', goToInviteLink);
    window.Icons?.hydrate?.(document.getElementById('invite'));
    updateShowcase();

    window.SecureWeb3?.on?.((event, payload) => {
      if (event === 'connected' || event === 'disconnected') updateShowcase();
      if (event !== 'connected') return;
      const addr = payload?.address || window.SecureWeb3?.getAddress?.();
      if (!addr) return;
      registerCode(addr);
      processPendingForWallet(addr).then((result) => {
        if (result.ok) {
          window.AppUI?.toast?.(
            'Invite counted! Your friend just earned a free ticket + free spins.',
            'success'
          );
          window.PlayerDashboard?.refresh?.();
          window.SlotMachine?.updateFreeUI?.();
          window.Roulette?.updateFreeUI?.();
          window.LotteryApp?.updateFreeTicketUI?.();
        }
      });
      pullRewardsForWallet(addr);
    });
  }

  return {
    init,
    captureFromUrl,
    getShareLink,
    registerCode,
    getBonus,
    grantBonus,
    consumeBonusSpin,
    getStats,
    processPendingForWallet,
    pullRewardsForWallet,
    updateShowcase,
    goToInviteLink,
    REWARD,
  };
})();

window.Referrals = Referrals;
