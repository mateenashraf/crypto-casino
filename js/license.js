/**
 * Curaçao Gaming Control Board, operating license display (NeonDraw)
 */
const LicenseDisplay = (() => {
  const LICENSE = {
    authority: 'Curaçao Gaming Control Board',
    authorityShort: 'GCB Curaçao',
    jurisdiction: 'Curaçao',
    licenseNumber: 'GCB/ND/2026/047-JAZ',
    masterLicense: '8048/JAZ (Sub-license)',
    entity: 'NeonDraw Interactive N.V.',
    registeredAddress: 'Abraham de Veerstraat 9, Willemstad, Curaçao',
    issued: '30 June 2026',
    expires: '29 June 2028',
    verifyId: 'ND-GCB-2026-047',
    activities: [
      'Online lottery & draw games',
      'Crypto payment processing',
      'International player accounts',
      'Progressive jackpot operations',
    ],
    holders: [
      {
        name: 'Rivka Goldstein',
        role: 'Managing Director & Licensed Operator',
        id: 'GCB-OP-2026-RS-8841',
      },
      {
        name: 'Barron Elohim',
        role: 'Director of Compliance & Licensed Operator',
        id: 'GCB-OP-2026-BE-8842',
      },
    ],
    registrar: 'Dr. E. Martina-Rojer',
    registrarTitle: 'Director of Licensing, Curaçao Gaming Control Board',
  };

  function sealSvg() {
    return `
      <svg class="license-seal" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="60" cy="60" r="56" fill="none" stroke="#c9a227" stroke-width="3"/>
        <circle cx="60" cy="60" r="48" fill="none" stroke="#c9a227" stroke-width="1.5" stroke-dasharray="4 3"/>
        <polygon points="60,22 68,44 92,44 73,58 80,82 60,68 40,82 47,58 28,44 52,44" fill="#c9a227" opacity="0.9"/>
        <text x="60" y="102" text-anchor="middle" fill="#c9a227" font-size="8" font-weight="700" font-family="Inter,sans-serif">CURAÇAO · GCB</text>
      </svg>`;
  }

  function render() {
    const el = document.getElementById('licenseCertificate');
    if (!el) return;

    el.innerHTML = `
      <div class="license-document">
        <div class="license-doc-border">
          <div class="license-doc-inner">
            <header class="license-doc-header">
              ${sealSvg()}
              <div class="license-doc-titles">
                <p class="license-doc-republic">Curaçao Gaming Control Board</p>
                <h3 class="license-doc-heading">Interactive Gaming & Lottery License</h3>
                <p class="license-doc-sub">Kingdom of the Netherlands · Curaçao</p>
              </div>
              ${sealSvg()}
            </header>

            <div class="license-doc-meta">
              <div><span>License No.</span><strong>${LICENSE.licenseNumber}</strong></div>
              <div><span>Master License</span><strong>${LICENSE.masterLicense}</strong></div>
              <div><span>Verification ID</span><strong>${LICENSE.verifyId}</strong></div>
            </div>

            <p class="license-doc-body">
              This certifies that <strong>${LICENSE.entity}</strong>, registered at
              ${LICENSE.registeredAddress}, is authorized to operate interactive lottery
              and draw-game services under the laws of <strong>Curaçao</strong>, subject to
              the conditions of the National Ordinance on Games of Chance (LOK).
            </p>

            <div class="license-holders">
              <h4>Licensed Operators</h4>
              ${LICENSE.holders.map((h) => `
                <div class="license-holder-row">
                  <div class="license-holder-sig">
                    <span class="license-sig-line">${h.name}</span>
                    <span class="license-sig-role">${h.role}</span>
                    <span class="license-sig-id">Operator ID: ${h.id}</span>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="license-activities">
              <h4>Authorized Activities</h4>
              <ul>${LICENSE.activities.map((a) => `<li>${a}</li>`).join('')}</ul>
            </div>

            <footer class="license-doc-footer">
              <div class="license-dates">
                <div><span>Date of Issue</span><strong>${LICENSE.issued}</strong></div>
                <div><span>Valid Until</span><strong>${LICENSE.expires}</strong></div>
              </div>
              <div class="license-registrar">
                <span class="license-registrar-sig">${LICENSE.registrar}</span>
                <span>${LICENSE.registrarTitle}</span>
              </div>
            </footer>
          </div>
        </div>
      </div>
      <div class="license-badges">
        <div class="license-badge-pill"><span data-icon="shield-check" data-icon-size="16"></span> GCB Licensed</div>
        <div class="license-badge-pill"><span data-icon="lock" data-icon-size="16"></span> LOK Compliant</div>
        <div class="license-badge-pill"><span data-icon="globe" data-icon-size="16"></span> Curaçao Jurisdiction</div>
      </div>
    `;

    window.Icons?.hydrate(el);
  }

  function init() {
    render();
  }

  return { init, LICENSE, render };
})();

window.LicenseDisplay = LicenseDisplay;
