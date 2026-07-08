/**
 * Runtime config — treasury and API base injected at deploy; never commit secrets.
 */
(function () {
  const host = location.hostname;
  const isDev = host === 'localhost' || host === '127.0.0.1';
  window.__ND_CFG__ = Object.freeze({
    apiBase: isDev ? '' : '',
    treasury: '',
  });

  if (isDev) {
    const s = document.createElement('script');
    s.src = 'js/dev-grants.js?v=neondraw';
    s.defer = true;
    document.head.appendChild(s);
  }
})();
