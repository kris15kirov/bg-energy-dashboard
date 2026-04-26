// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Sidebar Component
// ═══════════════════════════════════════════════════════

import { SIDEBAR_NAV } from '../data/constants.js';

export function createSidebar(activeId, onNavigate) {
    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';

    // Mobile Header
    const mobileHeader = document.createElement('div');
    mobileHeader.className = 'sidebar__mobile-header';
    mobileHeader.innerHTML = `
        <span style="font-weight: bold; font-size: 0.9rem; color: var(--text-heading)">Menu</span>
        <button class="sidebar__close-btn" title="Close Menu">✕</button>
    `;
    mobileHeader.querySelector('.sidebar__close-btn').addEventListener('click', () => {
        sidebar.classList.remove('sidebar--open');
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) overlay.classList.remove('sidebar-overlay--active');
    });
    sidebar.appendChild(mobileHeader);

    for (const group of SIDEBAR_NAV) {
        const groupEl = document.createElement('div');
        groupEl.className = 'sidebar__group';

        const label = document.createElement('div');
        label.className = 'sidebar__group-label';
        if (group.group === 'ANALYTICS') {
            label.innerHTML = `${group.group} <b style="color:var(--text-heading);">(NEW)</b>`;
        } else {
            label.textContent = group.group;
        }
        groupEl.appendChild(label);

        for (const item of group.items) {
            const itemEl = document.createElement('div');
            itemEl.className = `sidebar__item${item.id === activeId ? ' sidebar__item--active' : ''}`;
            itemEl.dataset.id = item.id;
            
            if (item.active !== false) {
                // Working section
                itemEl.style.fontWeight = 'bold';
                
                if (item.mocked) {
                    itemEl.style.flexDirection = 'column';
                    itemEl.style.alignItems = 'flex-start';
                    itemEl.innerHTML = `
                        <div>${item.label}</div>
                        <div style="font-size: 0.75rem; font-style: italic; font-weight: normal; color: var(--text-muted); margin-top: 2px;">mocked data</div>
                    `;
                } else {
                    itemEl.textContent = item.label;
                }
                
                itemEl.addEventListener('click', () => {
                    onNavigate(item.id);
                });
            } else {
                // Non-working section
                itemEl.style.opacity = '0.5';
                itemEl.style.cursor = 'not-allowed';
                itemEl.style.flexDirection = 'column';
                itemEl.style.alignItems = 'flex-start';
                itemEl.innerHTML = `
                    <div style="font-weight: normal;">${item.label}</div>
                    <div style="font-size: 0.75rem; font-style: italic; margin-top: 2px;">coming soon</div>
                `;
            }

            groupEl.appendChild(itemEl);
        }

        sidebar.appendChild(groupEl);
    }

    return sidebar;
}

export function updateSidebarActive(sidebar, activeId) {
    sidebar.querySelectorAll('.sidebar__item').forEach(el => {
        el.classList.toggle('sidebar__item--active', el.dataset.id === activeId);
    });
}
