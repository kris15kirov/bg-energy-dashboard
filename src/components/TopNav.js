// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — TopNav Component
// ═══════════════════════════════════════════════════════

import { TOP_NAV_MODULES } from '../data/constants.js';

export function createTopNav() {
  const nav = document.createElement('nav');
  nav.className = 'top-nav';

  nav.innerHTML = `
    <div class="top-nav__logo">
      <div class="top-nav__logo-icon">⚡</div>
      <span>BG Energy</span>
    </div>
    <div class="top-nav__modules">
      ${TOP_NAV_MODULES.map(m => `
        <button class="top-nav__module ${m.active ? 'top-nav__module--active' : ''}" data-module="${m.id}" ${!m.active ? 'style="opacity: 0.5; cursor: not-allowed; font-style: italic;" title="Coming soon"' : 'style="font-weight: bold;"'}>
          ${m.label}
        </button>
      `).join('')}
    </div>
    <div class="top-nav__right">
      <div class="pill-group" id="theme-toggle" title="Toggle Theme">
        <button class="pill" data-theme-val="light">Light</button>
        <button class="pill" data-theme-val="dark">Dark</button>
      </div>
      <button class="top-nav__settings" title="Settings">⚙</button>
    </div>
  `;

  return nav;
}
