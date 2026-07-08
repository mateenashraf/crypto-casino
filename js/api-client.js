/**
 * Server API client — authoritative payouts and draw data in production.
 */
const NeonDrawApi = (() => {
  function base() {
    const cfg = window.__ND_CFG__?.apiBase;
    return cfg == null ? '' : String(cfg);
  }

  function useServer() {
    if (!base() && !window.SecureRuntime?.isProduction?.()) return false;
    return window.SecureRuntime?.isProduction?.() || !!base();
  }

  async function request(path, { method = 'GET', body } = {}) {
    const url = `${base()}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function processPayout({ wallet, usdAmount, type, meta = {} }) {
    return request('/api/payouts/process', {
      method: 'POST',
      body: {
        wallet,
        usdAmount,
        type,
        metaJson: JSON.stringify(meta),
      },
    });
  }

  async function fetchWinners(limit = 50) {
    return request(`/api/draws/winners?limit=${limit}`);
  }

  async function fetchDraws() {
    return request('/api/draws');
  }

  return { base, useServer, processPayout, fetchWinners, fetchDraws };
})();

window.NeonDrawApi = NeonDrawApi;
