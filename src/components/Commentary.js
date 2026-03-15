// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Commentary Component
// ═══════════════════════════════════════════════════════

import { COMMENTARY_TABS } from '../data/constants.js';
import { formatDateFull } from '../utils/formatters.js';

export function createCommentary(nowDate, lastUpdated) {
  const tomorrow = new Date(nowDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(nowDate);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const el = document.createElement('div');
  el.className = 'commentary';

  el.innerHTML = `
    <div class="commentary__date">Updated ${lastUpdated}</div>
    <h3 class="commentary__heading">Comment on the day-ahead market, ${formatDateFull(tomorrow)}</h3>

    <div class="commentary__tabs">
      ${COMMENTARY_TABS.map((tab, i) => `
        <button class="commentary__tab${i === 0 ? ' commentary__tab--active' : ''}" data-tab="${i}">${tab}</button>
      `).join('')}
    </div>

    <div class="commentary__content">
      <div class="commentary__section">
        <h4 class="commentary__section-title">Settlement</h4>
        <p class="commentary__text">
          Tomorrow's spot price settled at <strong style="color:var(--text-heading)">98.42 EUR/MWh</strong>
          (up 12.35 EUR/MWh from today), averaging 87.15 EUR/MWh during peak hours
          (up 35.20 EUR/MWh from today). Compared to last Monday, the price is down
          15.80 EUR/MWh for base, and down 8.25 EUR/MWh in peak. The price reaches a
          low of 42.10 EUR/MWh at 04:00-05:00, and a high of 178.55 EUR/MWh at 19:00-20:00.
        </p>
      </div>

      <div class="commentary__section">
        <h4 class="commentary__section-title">Expected change from tomorrow to ${formatDateFull(dayAfter).split(',')[0]}</h4>
        <p class="commentary__text">
          <strong style="color:var(--text-heading)">Spot price, exchange, and residual production</strong><br><br>
          Our prognosis estimates that the spot price will increase by 2.15 EUR/MWh to
          100.57 EUR/MWh ${formatDateFull(dayAfter).split(',')[0]}, with average price of 92.30 EUR/MWh during peak hours.
          We expect a decrease of 0.45 GWh/h in scheduled net export. Our latest
          projections expect that residual production will rise slightly by 0.03 GWh/h,
          landing at 1.58 GWh/h.
        </p>
      </div>

      <div class="commentary__section">
        <span class="commentary__bull-bear commentary__bull-bear--bull">▲ Bullish</span>
      </div>

      <div class="commentary__section">
        <h4 class="commentary__section-title">Key Drivers</h4>
        <p class="commentary__text">
          • Wind production expected to <strong style="color:var(--color-negative)">decrease</strong> by 120 MWh/h<br>
          • Solar output <strong style="color:var(--color-positive)">stable to increasing</strong> with clear skies forecast<br>
          • Nuclear baseload operating at 94% capacity<br>
          • Cross-border flows tilting towards net import from Romania<br>
          • Temperature expected to drop 2.1°C, increasing heating demand
        </p>
      </div>
    </div>
  `;

  // Tab switching
  el.querySelectorAll('.commentary__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      el.querySelectorAll('.commentary__tab').forEach(t => t.classList.remove('commentary__tab--active'));
      tab.classList.add('commentary__tab--active');
    });
  });

  return el;
}
