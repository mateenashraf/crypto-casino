/**
 * Server API + shared live authority client.
 */
const NeonDrawApi = (() => {
  function base() {
    const cfg = window.__ND_CFG__?.apiBase;
    return cfg == null ? '' : String(cfg);
  }

  function useServer() {
    return window.LiveFeed?.isShared?.() === true;
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

  async function fetchWinners(limit = 50) {
    try {
      const rows = await request('/api/live/winners');
      return Array.isArray(rows) ? rows.slice(0, limit) : [];
    } catch {
      return [];
    }
  }

  async function fetchLiveFeed() {
    return request('/api/live/feed');
  }

  return { base, useServer, fetchWinners, fetchLiveFeed };
})();

window.NeonDrawApi = NeonDrawApi;
