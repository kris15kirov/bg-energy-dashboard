// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — FilterBar Component
// ═══════════════════════════════════════════════════════

import { MODELS, RESOLUTIONS, NEIGHBORS } from '../data/constants.js';

export function createFilterBar(state, onStateChange) {
  const bar = document.createElement('div');
  bar.className = 'filter-bar';

  bar.innerHTML = `
    <!-- Area -->
    <div class="filter-bar__section area-selector">
      <span class="area-selector__main">🇧🇬 Bulgaria <span style="font-size:10px;color:var(--text-muted)">▾</span></span>
      <div class="area-selector__neighbors">
        ${NEIGHBORS.map(n => `<span class="area-tag">${n}</span>`).join('')}
      </div>
    </div>

    <div class="filter-bar__separator"></div>

    <!-- Resolution -->
    <div class="filter-bar__section">
      <div class="pill-group" id="resolution-pills">
        ${RESOLUTIONS.map(r => `
          <button class="pill${r === state.resolution ? ' pill--active' : ''}" data-res="${r}">${r}</button>
        `).join('')}
      </div>
    </div>

    <div class="filter-bar__separator"></div>

    <!-- Time Slider -->
    <div class="filter-bar__section time-slider">
      <span class="time-slider__label">1 week</span>
      <div class="time-slider__track">
        <div class="time-slider__fill"></div>
        <div class="time-slider__handle time-slider__handle--left"></div>
        <div class="time-slider__handle time-slider__handle--right"></div>
      </div>
      <span class="time-slider__label">2 weeks</span>
      <button class="time-slider__refresh" title="Reset time range">↻</button>
    </div>

    <div class="filter-bar__separator"></div>

    <!-- Model Toggles -->
    <div class="filter-bar__section model-toggles" id="model-toggles">
      ${MODELS.map(m => `
        <button class="model-pill${state.enabledModels.has(m.id) ? ' model-pill--active' : ''}"
                data-model="${m.id}">${m.label}</button>
      `).join('')}
    </div>

    <div class="filter-bar__separator"></div>

    <!-- Currency -->
    <div class="filter-bar__section">
      <select class="currency-select" id="currency-select">
        <option value="EUR" selected>Local (EUR)</option>
      </select>
    </div>

    <!-- Archive -->
    <div class="filter-bar__section">
      <button class="archive-btn">📅 Archive</button>
    </div>
  `;

  // Resolution clicks
  bar.querySelector('#resolution-pills').addEventListener('click', (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    bar.querySelectorAll('#resolution-pills .pill').forEach(p => p.classList.remove('pill--active'));
    btn.classList.add('pill--active');
    onStateChange({ resolution: btn.dataset.res });
  });

  // Model toggles
  bar.querySelector('#model-toggles').addEventListener('click', (e) => {
    const btn = e.target.closest('.model-pill');
    if (!btn) return;
    btn.classList.toggle('model-pill--active');
    const modelId = btn.dataset.model;
    const newSet = new Set(state.enabledModels);
    if (newSet.has(modelId)) {
      newSet.delete(modelId);
    } else {
      newSet.add(modelId);
    }
    state.enabledModels = newSet;
    onStateChange({ enabledModels: newSet });
  });

  // Currency
  bar.querySelector('#currency-select').addEventListener('change', (e) => {
    onStateChange({ currency: e.target.value });
  });

  return bar;
}
