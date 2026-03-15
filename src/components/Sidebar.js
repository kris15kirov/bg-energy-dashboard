// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Sidebar Component
// ═══════════════════════════════════════════════════════

import { SIDEBAR_NAV } from '../data/constants.js';

export function createSidebar(activeId, onNavigate) {
    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';

    for (const group of SIDEBAR_NAV) {
        const groupEl = document.createElement('div');
        groupEl.className = 'sidebar__group';

        const label = document.createElement('div');
        label.className = 'sidebar__group-label';
        label.textContent = group.group;
        groupEl.appendChild(label);

        for (const item of group.items) {
            const itemEl = document.createElement('div');
            itemEl.className = `sidebar__item${item.id === activeId ? ' sidebar__item--active' : ''}`;
            itemEl.textContent = item.label;
            itemEl.dataset.id = item.id;
            itemEl.addEventListener('click', () => {
                onNavigate(item.id);
            });
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
