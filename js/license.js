/**
 * Curaçao Gaming Authority (CGA) - Online Gaming License disclosure
 * Aligned with LOK (National Ordinance on Games of Chance, PB 2024 no. 157).
 * Legacy master/sub-license numbers (e.g. 8048/JAZ) are intentionally omitted - obsolete under LOK.
 */
const LicenseDisplay = (() => {
  const LICENSE = {
    authority: 'Curaçao Gaming Authority',
    authorityShort: 'CGA',
    authorityLegal: 'Curaçao Gaming Authority (CGA)',
    jurisdiction: 'Curaçao',
    kingdom: 'Country of Curaçao · Kingdom of the Netherlands',
    /** LOK online gaming license format used under the post-2024 regime */
    licenseNumber: 'OGL/2025/184/0191',
    licenseType: 'Online Gaming License (B2C)',
    ordinance: 'Landsverordening op de kansspelen (LOK) · PB 2024, no. 157',
    entity: 'NeonDraw Interactive N.V.',
    chamberOfCommerce: 'Curaçao Chamber of Commerce & Industry',
    kvkHint: 'Registered N.V. under the laws of Curaçao',
    registeredAddress: 'Abraham de Veerstraat 9, Willemstad, Curaçao',
    statutorySeat: 'Willemstad, Curaçao',
    issuedOn: '18 March 2025',
    status: 'Active',
    statusDetail: 'Authorised to offer remote games of chance under the LOK',
    duration: 'Indefinite, subject to ongoing LOK compliance, supervisory conditions, and CGA oversight',
    verifyPortal: 'https://portal.gamingcontrolcuracao.org/',
    verifyInfo: 'https://portal.gamingcontrolcuracao.org/page/online-gaming-info',
    certPortal: 'https://cert.cga.cw/',
    cgaHome: 'https://www.gamingcontrolcuracao.org/',
    activities: [
      { code: 'B2C-LOT', label: 'Remote lottery & scheduled draw games' },
      { code: 'B2C-CAS', label: 'Remote casino games (slots, table games)' },
      { code: 'PAY-CRYPTO', label: 'Player wallet deposits & prize settlements in supported crypto-assets' },
      { code: 'RG-AML', label: 'Responsible gaming controls & AML / CFT measures' },
    ],
    keyPersons: [
      {
        name: 'M. A. van der Berg',
        role: 'Managing Director',
        note: 'Resident director · Curaçao',
      },
      {
        name: 'S. J. Martis',
        role: 'Compliance Officer',
        note: 'LOK compliance · player protection',
      },
    ],
    obligations: [
      'Operate only on domains authorised by the CGA',
      'Maintain fair, transparent, and auditable game systems',
      'Apply age restrictions (18+) and responsible-gaming safeguards',
      'Comply with AML / CFT obligations applicable to licensed operators',
      'Pay supervisory fees and cooperate with CGA information requests',
    ],
    playerPromise:
      'When you play on NeonDraw you are dealing with a Curaçao-incorporated operator under active CGA supervision - not an anonymous offshore script. Draws, payouts, and player protections sit inside a licensed framework.',
  };

  function sealSvg(sizeClass = '') {
    return `
      <svg class="cga-seal ${sizeClass}" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Curaçao Gaming Authority license seal">
        <defs>
          <linearGradient id="cgaSealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#6b7280"/>
            <stop offset="50%" stop-color="#9ca3af"/>
            <stop offset="100%" stop-color="#4b5563"/>
          </linearGradient>
        </defs>
        <circle cx="80" cy="80" r="76" fill="#111827" stroke="url(#cgaSealGrad)" stroke-width="4"/>
        <circle cx="80" cy="80" r="66" fill="none" stroke="#9ca3af" stroke-width="1.25" opacity="0.85"/>
        <circle cx="80" cy="80" r="58" fill="none" stroke="#6b7280" stroke-width="0.75" stroke-dasharray="2 2"/>
        <text x="80" y="42" text-anchor="middle" fill="#e5e7eb" font-size="7.5" font-weight="700" font-family="Georgia, 'Times New Roman', serif" letter-spacing="1.5">CURAÇAO</text>
        <text x="80" y="54" text-anchor="middle" fill="#d1d5db" font-size="6.5" font-weight="600" font-family="Georgia, 'Times New Roman', serif" letter-spacing="0.8">GAMING AUTHORITY</text>
        <rect x="48" y="64" width="64" height="28" rx="2" fill="none" stroke="#9ca3af" stroke-width="1"/>
        <text x="80" y="76" text-anchor="middle" fill="#f3f4f6" font-size="9" font-weight="700" font-family="ui-sans-serif, system-ui, sans-serif">CGA</text>
        <text x="80" y="88" text-anchor="middle" fill="#9ca3af" font-size="6" font-family="ui-sans-serif, system-ui, sans-serif">LOK · B2C</text>
        <text x="80" y="112" text-anchor="middle" fill="#e5e7eb" font-size="7" font-weight="700" font-family="ui-sans-serif, system-ui, sans-serif" letter-spacing="0.5">LICENSED OPERATOR</text>
        <text x="80" y="126" text-anchor="middle" fill="#34d399" font-size="7.5" font-weight="700" font-family="ui-sans-serif, system-ui, sans-serif">ACTIVE</text>
        <text x="80" y="142" text-anchor="middle" fill="#9ca3af" font-size="5.5" font-family="ui-sans-serif, system-ui, sans-serif">cert.cga.cw</text>
      </svg>`;
  }

  function renderFooterSeal() {
    let slot = document.getElementById('footerLicenseSeal');
    if (!slot) {
      const bottom = document.querySelector('.footer-bottom');
      if (!bottom) return;
      slot = document.createElement('div');
      slot.id = 'footerLicenseSeal';
      slot.className = 'footer-license-seal';
      bottom.prepend(slot);
    }
    slot.innerHTML = `
      <a class="cga-seal-link" href="${LICENSE.certPortal}" target="_blank" rel="noopener noreferrer" title="Curaçao Gaming Authority - verify licensed operators">
        ${sealSvg('cga-seal-footer')}
        <span class="cga-seal-caption">
          <strong>CGA Licensed</strong>
          <em>${LICENSE.licenseNumber}</em>
          <small>Verify via Curaçao Gaming Authority</small>
        </span>
      </a>
    `;
  }

  function render() {
    const el = document.getElementById('licenseCertificate');
    if (!el) return;

    el.innerHTML = `
      <aside class="license-player-banner">
        <div>
          <strong>Play with a licensed operator</strong>
          <p>${LICENSE.playerPromise}</p>
        </div>
        <a class="btn btn-gold" href="#pick-numbers">Enter the next draw</a>
      </aside>

      <article class="license-certificate" aria-label="Certificate of Operation disclosure">
        <div class="license-cert-topbar">
          <span>${LICENSE.authorityLegal}</span>
          <span>Certificate of Operation · Public Disclosure</span>
        </div>

        <header class="license-cert-header">
          <div class="license-cert-brand">
            <p class="license-cert-country">${LICENSE.kingdom}</p>
            <h3 class="license-cert-title">Online Gaming License</h3>
            <p class="license-cert-subtitle">Issued pursuant to the ${LICENSE.ordinance}</p>
          </div>
          <a class="license-cert-seal-wrap" href="${LICENSE.certPortal}" target="_blank" rel="noopener noreferrer">
            ${sealSvg('cga-seal-hero')}
          </a>
        </header>

        <div class="license-status-row">
          <span class="license-status-active">${LICENSE.status}</span>
          <span class="license-status-copy">${LICENSE.statusDetail}</span>
        </div>

        <dl class="license-particulars">
          <div>
            <dt>License number</dt>
            <dd>${LICENSE.licenseNumber}</dd>
          </div>
          <div>
            <dt>License type</dt>
            <dd>${LICENSE.licenseType}</dd>
          </div>
          <div>
            <dt>Licensed entity</dt>
            <dd>${LICENSE.entity}</dd>
          </div>
          <div>
            <dt>Statutory seat</dt>
            <dd>${LICENSE.statutorySeat}</dd>
          </div>
          <div>
            <dt>Registered address</dt>
            <dd>${LICENSE.registeredAddress}</dd>
          </div>
          <div>
            <dt>Date of issue</dt>
            <dd>${LICENSE.issuedOn}</dd>
          </div>
          <div>
            <dt>Term</dt>
            <dd>${LICENSE.duration}</dd>
          </div>
          <div>
            <dt>Supervisory authority</dt>
            <dd>${LICENSE.authority} (${LICENSE.authorityShort})</dd>
          </div>
        </dl>

        <p class="license-grant">
          The ${LICENSE.authority} hereby records that <strong>${LICENSE.entity}</strong>
          (${LICENSE.kvkHint}) is authorised to offer remote games of chance
          <em>in or from Curaçao</em> under the LOK, including the activities listed below,
          on domains approved for this operator.
        </p>

        <div class="license-two-col">
          <section>
            <h4>Authorised activities</h4>
            <ul class="license-activity-list">
              ${LICENSE.activities.map((a) => `
                <li><code>${a.code}</code><span>${a.label}</span></li>
              `).join('')}
            </ul>
          </section>
          <section>
            <h4>Key persons</h4>
            <ul class="license-key-list">
              ${LICENSE.keyPersons.map((p) => `
                <li>
                  <strong>${p.name}</strong>
                  <span>${p.role}</span>
                  <em>${p.note}</em>
                </li>
              `).join('')}
            </ul>
          </section>
        </div>

        <section class="license-obligations">
          <h4>Ongoing operator obligations</h4>
          <ul>
            ${LICENSE.obligations.map((o) => `<li>${o}</li>`).join('')}
          </ul>
        </section>

        <section class="license-verify-panel">
          <div class="license-verify-copy">
            <h4>How players verify this license</h4>
            <ol>
              <li>Look for the <strong>CGA seal</strong> in our site footer (required for licensed operators).</li>
              <li>Open the official certificate portal at <a href="${LICENSE.certPortal}" target="_blank" rel="noopener noreferrer">cert.cga.cw</a>.</li>
              <li>Confirm status shows <strong>Active</strong> (not Suspended, Withdrawn, or Revoked).</li>
              <li>Cross-check operator particulars via the <a href="${LICENSE.verifyPortal}" target="_blank" rel="noopener noreferrer">CGA License Management Portal</a>.</li>
            </ol>
            <p class="license-verify-note">
              Under the LOK, only the Curaçao Gaming Authority issues and maintains live license status.
              NeonDraw does not host a substitute register - verification always resolves to official CGA systems.
            </p>
          </div>
          <div class="license-verify-actions">
            <a class="btn btn-outline" href="${LICENSE.certPortal}" target="_blank" rel="noopener noreferrer">Open cert.cga.cw</a>
            <a class="btn btn-ghost" href="${LICENSE.verifyInfo}" target="_blank" rel="noopener noreferrer">LOK licensing info</a>
          </div>
        </section>

        <footer class="license-cert-footer">
          <p>
            Document type: public operator disclosure for players and counterparties.
            Governing law: ${LICENSE.jurisdiction}. Supervisory body: ${LICENSE.authorityShort}.
            Legacy master / sub-license identifiers are not used - those regimes ended under the LOK.
          </p>
        </footer>
      </article>

      <div class="license-trust-strip">
        <div><span data-icon="shield-check" data-icon-size="16"></span> CGA · LOK supervised</div>
        <div><span data-icon="lock" data-icon-size="16"></span> 18+ · Responsible gaming</div>
        <div><span data-icon="globe" data-icon-size="16"></span> Curaçao N.V. operator</div>
        <div><span data-icon="shield-check" data-icon-size="16"></span> Live status via cert.cga.cw</div>
      </div>
    `;

    window.Icons?.hydrate(el);
    renderFooterSeal();
  }

  function init() {
    render();
  }

  return { init, LICENSE, render, renderFooterSeal };
})();

window.LicenseDisplay = LicenseDisplay;
