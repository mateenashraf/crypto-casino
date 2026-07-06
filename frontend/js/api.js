/**
 * NeonDraw API client — talks to the ASP.NET Core backend.
 * Base URL is configurable (persisted in localStorage) so the frontend and API
 * can be deployed and run independently.
 */
(function () {
  const KEY = 'neondraw_api_base';
  const DEFAULT_BASE = 'http://localhost:5080';

  function getBase() {
    return localStorage.getItem(KEY) || window.NEONDRAW_API || DEFAULT_BASE;
  }
  function setBase(url) {
    localStorage.setItem(KEY, url.replace(/\/+$/, ''));
  }

  async function request(path, options = {}) {
    const res = await fetch(getBase() + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg = (data && data.error) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  window.NeonDrawApi = {
    getBase,
    setBase,
    health: () => request('/health'),
    getDraws: () => request('/api/draws'),
    getDraw: (id) => request(`/api/draws/${id}`),
    settleDraw: (id) => request(`/api/draws/${id}/settle`, { method: 'POST' }),
    getWinners: (limit = 20) => request(`/api/winners?limit=${limit}`),
    buyTicket: (payload) => request('/api/tickets', { method: 'POST', body: JSON.stringify(payload) }),
    lookupTickets: (wallet) => request(`/api/tickets?wallet=${encodeURIComponent(wallet)}`),
    getStats: () => request('/api/stats'),
    getPoolPolicy: () => request('/api/pool-policy'),
  };
})();
