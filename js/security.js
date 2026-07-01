/**
 * StarBitz client-side security utilities.
 * Defense-in-depth helpers used across the app:
 *   - HTML output encoding to prevent stored / DOM-based XSS
 *   - Best-effort clickjacking (UI-redress) protection for static hosting
 */
(function () {
  'use strict';

  // HTML-encode any value before it is interpolated into innerHTML. This is the
  // primary defense against XSS for data that originates outside the source code
  // (wallet addresses, localStorage contents, future server/API data, etc.).
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Clickjacking / UI-redress protection. `frame-ancestors` (CSP) and
  // `X-Frame-Options` can only be delivered as HTTP response headers and are
  // ignored inside a <meta> tag, so on static hosting (e.g. GitHub Pages) we
  // additionally break out of any unexpected framing here.
  function preventFraming() {
    try {
      if (window.top !== window.self) {
        window.top.location = window.self.location.href;
      }
    } catch (_) {
      // Cross-origin parent blocks access: hide the page so it cannot be
      // used as an invisible overlay in a clickjacking attack.
      document.documentElement.style.display = 'none';
    }
  }

  preventFraming();

  window.SBSecurity = { escapeHtml };
})();
