/**
 * Runtime bootstrap - dev tools on localhost only. No public API or pool config on window.
 */
(function () {
  const host = location.hostname;
  const isDev = host === 'localhost' || host === '127.0.0.1';
  if (isDev) {
    const s = document.createElement('script');
    s.src = 'js/dev-grants.js?v=neondraw';
    s.defer = true;
    document.head.appendChild(s);
  }
})();
