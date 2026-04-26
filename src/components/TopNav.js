// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — TopNav Component
// ═══════════════════════════════════════════════════════

import { TOP_NAV_MODULES } from '../data/constants.js';

export function createTopNav() {
  const nav = document.createElement('nav');
  nav.className = 'top-nav';

  nav.innerHTML = `
    <button id="menu-toggle" class="menu-toggle-btn" title="Open Menu">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
    </button>
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
      <button id="theme-toggle" class="theme-toggle-btn" title="Toggle Theme">
        <span class="theme-toggle-icon"></span>
        <span class="theme-toggle-text"></span>
      </button>
    </div>
  `;

  return nav;
}
