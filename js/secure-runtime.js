/**
 * Production runtime hardening — deters casual inspection; not a substitute for server-side secrets.
 */
const SecureRuntime = (() => {
  const DEV_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

  function isProduction() {
    const host = location.hostname;
    return host && !DEV_HOSTS.has(host);
  }

  function isDevHost() {
    return !isProduction();
  }

  function applyProductionGuards() {
    if (!isProduction()) return;

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      const key = e.key?.toLowerCase();
      const block = (
        key === 'f12'
        || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 'k'].includes(key))
        || (e.ctrlKey && key === 'u')
        || (e.metaKey && e.altKey && key === 'i')
      );
      if (block) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    const noop = () => {};
    ['log', 'debug', 'info', 'warn', 'dir', 'table', 'trace'].forEach((m) => {
      try { console[m] = noop; } catch { /* */ }
    });

    try {
      Object.defineProperty(window, '__NEONDRAW_DEV__', {
        value: false,
        writable: false,
        configurable: false,
      });
    } catch { /* */ }
  }

  function scrubSensitiveGlobals() {
    if (!isProduction()) return;
    const hide = ['NeonDrawDev'];
    hide.forEach((name) => {
      try {
        if (window[name]) delete window[name];
      } catch { /* */ }
    });
  }

  applyProductionGuards();

  return { isProduction, isDevHost, scrubSensitiveGlobals };
})();

window.SecureRuntime = SecureRuntime;
