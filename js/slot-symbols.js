/**
 * Classic Vegas-style slot symbols - bright glossy SVG art (not emoji)
 */
const SlotSymbols = (() => {
  const SVGS = {
    cherry: `
<svg class="slot-svg" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <radialGradient id="ch-g1" cx="35%" cy="30%"><stop offset="0%" stop-color="#ff8fab"/><stop offset="55%" stop-color="#ff2d55"/><stop offset="100%" stop-color="#b8002e"/></radialGradient>
    <radialGradient id="ch-g2" cx="40%" cy="35%"><stop offset="0%" stop-color="#ff9db5"/><stop offset="60%" stop-color="#ff4060"/><stop offset="100%" stop-color="#c40030"/></radialGradient>
    <linearGradient id="ch-leaf" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#7dff9a"/><stop offset="100%" stop-color="#1fa84a"/></linearGradient>
  </defs>
  <path d="M32 8 C28 14 26 20 28 26 C24 22 18 24 16 30 C14 36 18 42 24 44" stroke="#2d8a45" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="22" cy="44" rx="11" ry="12" fill="url(#ch-g1)"/>
  <ellipse cx="20" cy="40" rx="4" ry="3" fill="rgba(255,255,255,0.45)" transform="rotate(-25 20 40)"/>
  <ellipse cx="40" cy="46" rx="11" ry="12" fill="url(#ch-g2)"/>
  <ellipse cx="38" cy="42" rx="4" ry="3" fill="rgba(255,255,255,0.4)" transform="rotate(-20 38 42)"/>
  <path d="M30 18 C32 14 36 12 40 14 C38 16 34 18 32 22 Z" fill="url(#ch-leaf)"/>
</svg>`,
    lemon: `
<svg class="slot-svg" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <radialGradient id="lm-g" cx="38%" cy="32%"><stop offset="0%" stop-color="#fff9a8"/><stop offset="45%" stop-color="#ffe566"/><stop offset="100%" stop-color="#e6a800"/></radialGradient>
    <linearGradient id="lm-shine" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="rgba(255,255,255,0.55)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></linearGradient>
  </defs>
  <ellipse cx="32" cy="34" rx="18" ry="22" fill="url(#lm-g)" transform="rotate(-12 32 34)"/>
  <ellipse cx="28" cy="28" rx="7" ry="10" fill="url(#lm-shine)" transform="rotate(-12 28 28)"/>
  <path d="M32 14 C34 10 38 8 42 10" stroke="#6b8f00" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="41" cy="10" rx="3" ry="2" fill="#8bc34a"/>
</svg>`,
    orange: `
<svg class="slot-svg" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <radialGradient id="or-g" cx="35%" cy="30%"><stop offset="0%" stop-color="#ffd080"/><stop offset="50%" stop-color="#ff9f43"/><stop offset="100%" stop-color="#e85d04"/></radialGradient>
    <radialGradient id="or-dimple" cx="50%" cy="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.12)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
  </defs>
  <circle cx="32" cy="36" r="20" fill="url(#or-g)"/>
  <circle cx="26" cy="30" r="6" fill="rgba(255,255,255,0.35)"/>
  <circle cx="38" cy="42" r="3" fill="url(#or-dimple)"/>
  <circle cx="42" cy="38" r="2.5" fill="url(#or-dimple)"/>
  <circle cx="34" cy="46" r="2" fill="url(#or-dimple)"/>
  <path d="M32 18 C33 14 36 11 40 12" stroke="#5a8f00" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="40" cy="11" rx="4" ry="2.5" fill="#4caf50" transform="rotate(20 40 11)"/>
</svg>`,
    bell: `
<svg class="slot-svg" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="bl-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fff4a8"/><stop offset="35%" stop-color="#f5b731"/><stop offset="100%" stop-color="#c8860a"/></linearGradient>
    <linearGradient id="bl-shine" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="rgba(255,255,255,0)"/><stop offset="50%" stop-color="rgba(255,255,255,0.55)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></linearGradient>
  </defs>
  <path d="M32 10 L38 14 L38 18 C46 20 50 28 50 36 C50 44 44 48 32 48 C20 48 14 44 14 36 C14 28 18 20 26 18 L26 14 Z" fill="url(#bl-g)" stroke="#a87208" stroke-width="1.5"/>
  <rect x="22" y="48" width="20" height="5" rx="2" fill="#d4a017"/>
  <circle cx="32" cy="55" r="4" fill="url(#bl-g)" stroke="#a87208" stroke-width="1"/>
  <path d="M24 22 Q32 18 40 22" fill="none" stroke="url(#bl-shine)" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="28" cy="28" rx="5" ry="8" fill="rgba(255,255,255,0.25)" transform="rotate(-15 28 28)"/>
</svg>`,
    crown: `
<svg class="slot-svg" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="cr-g" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#fff8c4"/><stop offset="40%" stop-color="#ffd54f"/><stop offset="100%" stop-color="#f5a623"/></linearGradient>
    <linearGradient id="cr-band" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#e6a800"/><stop offset="50%" stop-color="#ffe066"/><stop offset="100%" stop-color="#e6a800"/></linearGradient>
    <radialGradient id="cr-jewel" cx="50%" cy="40%"><stop offset="0%" stop-color="#ff6b9d"/><stop offset="100%" stop-color="#c9184a"/></radialGradient>
  </defs>
  <path d="M10 44 L14 24 L22 34 L32 16 L42 34 L50 24 L54 44 Z" fill="url(#cr-g)" stroke="#c8860a" stroke-width="1.5" stroke-linejoin="round"/>
  <rect x="10" y="44" width="44" height="10" rx="2" fill="url(#cr-band)" stroke="#c8860a" stroke-width="1"/>
  <circle cx="32" cy="22" r="4" fill="url(#cr-jewel)" stroke="#fff" stroke-width="0.75"/>
  <circle cx="16" cy="30" r="3" fill="#7c5cfc" stroke="#fff" stroke-width="0.75"/>
  <circle cx="48" cy="30" r="3" fill="#00d68f" stroke="#fff" stroke-width="0.75"/>
  <circle cx="32" cy="49" r="3.5" fill="#ff3344" stroke="#fff" stroke-width="0.75"/>
  <path d="M12 26 L16 30 M48 26 L52 30" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linecap="round"/>
</svg>`,
    seven: `
<svg class="slot-svg slot-svg-seven" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="sv-g" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ff6b7a"/><stop offset="45%" stop-color="#ff1a3c"/><stop offset="100%" stop-color="#b8001f"/></linearGradient>
    <linearGradient id="sv-edge" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffe566"/><stop offset="100%" stop-color="#f5a623"/></linearGradient>
    <filter id="sv-glow"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#ff3344" flood-opacity="0.6"/></filter>
  </defs>
  <text x="32" y="46" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="44" font-weight="900" fill="url(#sv-g)" stroke="url(#sv-edge)" stroke-width="2.5" filter="url(#sv-glow)">7</text>
  <ellipse cx="24" cy="28" rx="6" ry="10" fill="rgba(255,255,255,0.22)" transform="rotate(-20 24 28)"/>
</svg>`,
  };

  /** Five classic Vegas reel symbols (cherry + orange & bell + crown & lucky 7) */
  const CATALOG = [
    { id: 'cherry', label: 'Cherry', color: '#ff4d6d', bg: 'linear-gradient(160deg, #4a1028 0%, #1a0810 100%)', mult: 2 },
    { id: 'orange', label: 'Orange', color: '#ff9f43', bg: 'linear-gradient(160deg, #3d2810 0%, #1a1208 100%)', mult: 3 },
    { id: 'bell', label: 'Bell', color: '#f5b731', bg: 'linear-gradient(160deg, #3d3010 0%, #1a1608 100%)', mult: 5 },
    { id: 'crown', label: 'Crown', color: '#ffc940', bg: 'linear-gradient(160deg, #3d3010 0%, #1a1408 100%)', mult: 15 },
    { id: 'seven', label: 'Lucky 7', color: '#ff3344', bg: 'linear-gradient(160deg, #3d1018 0%, #140810 100%)', mult: 25 },
  ];

  function render(id) {
    let svg = SVGS[id] || SVGS.cherry;
    const uid = `${id}-${Math.random().toString(36).slice(2, 7)}`;
    svg = svg.replace(/\bid="([^"]+)"/g, `id="${uid}-$1"`);
    svg = svg.replace(/url\(#([^)]+)\)/g, `url(#${uid}-$1)`);
    const label = CATALOG.find((s) => s.id === id)?.label || id;
    return `<span class="slot-art slot-art-${id}" role="img" aria-label="${label}">${svg}</span>`;
  }

  function paytableHtml() {
    return CATALOG.map((s) =>
      `<span class="slot-pay-icon" title="${s.label}">${render(s.id)}</span>`
    ).join('');
  }

  function getCatalog() {
    return CATALOG.slice();
  }

  function getById(id) {
    return CATALOG.find((s) => s.id === id) || CATALOG[0];
  }

  return { render, paytableHtml, getCatalog, getById, CATALOG };
})();

window.SlotSymbols = SlotSymbols;
