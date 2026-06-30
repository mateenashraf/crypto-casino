/**
 * Las Vegas gaming affiliates — authentic logos via Wikimedia Commons only.
 */
const PartnerNetwork = (() => {
  const VEGAS_PARTNERS = [
    {
      id: 'caesars-entertainment',
      name: 'Caesars Entertainment',
      tagline: 'Las Vegas Strip · Gaming & Entertainment',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Caesars_logo.svg',
      width: 200,
    },
    {
      id: 'caesars-palace',
      name: 'Caesars Palace',
      tagline: 'Las Vegas Strip · Iconic Resort',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Caesars_Palace.svg',
      width: 180,
    },
    {
      id: 'harrahs-las-vegas',
      name: "Harrah's Las Vegas",
      tagline: 'The Strip · Caesars Entertainment',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Harrah%27s_Las_Vegas_logo.svg',
      width: 180,
    },
    {
      id: 'planet-hollywood',
      name: 'Planet Hollywood Las Vegas',
      tagline: 'Las Vegas Strip · Resort & Casino',
      logoUrl: 'assets/partners/planet-hollywood.svg',
      width: 200,
      imgClass: 'partner-logo-ph',
      cardClass: 'partner-card-ph',
    },
    {
      id: 'the-linq',
      name: 'The LINQ',
      tagline: 'Las Vegas Strip · Hotel & Experience',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/af/The_LINQ_logo.svg',
      width: 160,
    },
  ];

  const BRAND_NAMES = [
    { name: 'NeonDraw', accent: 'Draw', tagline: 'Current — Vegas neon crypto lottery', current: true },
    { name: 'StarBitz', accent: 'Bitz', tagline: 'Previous brand name' },
    { name: 'LuxBit Jackpot', accent: 'Jackpot', tagline: 'Premium luxury lottery feel' },
    { name: 'VegasChain Lotto', accent: 'Lotto', tagline: 'Strip credibility + blockchain' },
    { name: 'CrownBit Grand', accent: 'Grand', tagline: 'High-roller jackpot positioning' },
    { name: 'StripFortune', accent: 'Fortune', tagline: 'Las Vegas fortune theme' },
    { name: 'DesertGold Crypto', accent: 'Gold', tagline: 'Nevada desert + gold jackpots' },
    { name: 'JackpotNeon', accent: 'Neon', tagline: 'Bold, ad-friendly for Google Ads' },
    { name: 'FortuneStrip', accent: 'Strip', tagline: 'Direct Vegas association' },
    { name: 'OasisBit Million', accent: 'Million', tagline: 'Million-dollar prize focus' },
    { name: 'PlatinumDraw', accent: 'Draw', tagline: 'VIP / platinum tier branding' },
    { name: 'CryptoCrown', accent: 'Crown', tagline: 'Royal + crypto hybrid' },
  ];

  function renderAffiliateSection() {
    const grid = document.getElementById('partnerGrid');
    if (!grid) return;

    grid.innerHTML = VEGAS_PARTNERS.map((p) => `
      <article class="partner-card partner-card-official ${p.cardClass || ''}" title="${p.name}">
        <div class="partner-logo-wrap partner-logo-real ${p.logoClass || ''}">
          <img
            src="${p.logoUrl}"
            alt="${p.name} logo"
            class="partner-real-logo ${p.imgClass || ''}"
            width="${p.width}"
            height="auto"
            loading="lazy"
          />
        </div>
        <div class="partner-meta">
          <strong>${p.name}</strong>
          <span>${p.tagline}</span>
        </div>
        <span class="partner-affiliate-badge partner-badge-official">Las Vegas Partner</span>
      </article>
    `).join('');
  }

  function renderBrandNames() {
    const el = document.getElementById('brandNameList');
    if (!el) return;

    el.innerHTML = BRAND_NAMES.map((b) => {
      const parts = b.name.split(' ');
      const last = parts.pop();
      const first = parts.join(' ') || '';
      const display = first
        ? `${first} <span class="brand-accent">${last}</span>`
        : `<span class="brand-accent">${b.name}</span>`;
      return `
        <button type="button" class="brand-name-chip ${b.current ? 'current' : ''}" data-brand="${b.name}" title="${b.tagline}">
          ${display}
          ${b.current ? '<span class="brand-current-tag">Live</span>' : ''}
        </button>`;
    }).join('');

    el.querySelectorAll('.brand-name-chip:not(.current)').forEach((chip) => {
      chip.addEventListener('click', () => {
        window.AppUI?.toast(`Brand preview: ${chip.dataset.brand} — update logo & title to switch`, 'info');
      });
    });
  }

  function init() {
    renderAffiliateSection();
    renderBrandNames();
  }

  return { init, VEGAS_PARTNERS, BRAND_NAMES };
})();

window.PartnerNetwork = PartnerNetwork;
