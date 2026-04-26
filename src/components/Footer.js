// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Footer Component
// ═══════════════════════════════════════════════════════

export function createFooter() {
    const footer = document.createElement('footer');
    footer.className = 'app-footer';

    footer.innerHTML = `
        <div class="footer-content">
            <div class="footer-brand">
                <div class="footer-logo">
                    <span class="footer-logo-icon">⚡</span>
                    <span class="footer-logo-text">BG Energy</span>
                </div>
                <p class="footer-description">
                    High-performance energy market intelligence platform.<br/>
                    Live price monitoring and algorithmic simulations.
                </p>
                <div class="footer-socials">
                    <a href="https://www.linkedin.com/in/kristiyankirov15/" target="_blank" class="social-link" title="LinkedIn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    </a>
                </div>
            </div>

            <div class="footer-section">
                <h4 class="footer-section-title">TEAM</h4>
                <ul class="footer-list">
                    <li class="footer-item">
                        <span class="footer-item-icon">👤</span>
                        <div class="footer-item-content">
                            <span class="footer-item-label">Student</span>
                            <span class="footer-item-value">Kristiyan Kirov</span>
                        </div>
                    </li>
                </ul>
            </div>

            <div class="footer-section">
                <h4 class="footer-section-title">CONTACTS</h4>
                <ul class="footer-list">
                    <li class="footer-item">
                        <span class="footer-item-icon">✉️</span>
                        <div class="footer-item-content">
                            <span class="footer-item-label">Email</span>
                            <a href="mailto:kristiyankirov15@gmail.com" class="footer-item-value">kristiyankirov15@gmail.com</a>
                        </div>
                    </li>
                    <li class="footer-item">
                        <span class="footer-item-icon" style="color: #0077b5;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                        </span>
                        <div class="footer-item-content">
                            <span class="footer-item-label">LinkedIn</span>
                            <a href="https://www.linkedin.com/in/kristiyankirov15/" target="_blank" class="footer-item-value">Professional Profile</a>
                        </div>
                    </li>
                </ul>
            </div>

            <div class="footer-section">
                <h4 class="footer-section-title">COLLABORATION</h4>
                <div class="footer-collab">
                    <p class="footer-collab-text">NIMH Cooperator:</p>
                    <div class="footer-cooperator">
                        <span class="footer-item-value">Lilia Bocheva, Assoc. Prof. PhD</span>
                        <span class="footer-item-label">Director of department of Meteorology</span>
                        <span class="footer-item-label">National Institute of Meteorology and Hydrology</span>
                        <a href="mailto:ilia.bocheva@meteo.bg" class="footer-item-value" style="font-size: var(--fs-xs); margin-top: 4px; opacity: 0.8;">ilia.bocheva@meteo.bg</a>
                    </div>
                    <a href="https://www.meteo.bg/" target="_blank" class="footer-collab-link">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                        www.meteo.bg
                    </a>
                </div>
            </div>
        </div>
        <div class="footer-bottom">
            <div class="footer-bottom-content">
                <span>&copy; 2026 BG Energy Dashboard</span>
                <span class="footer-bottom-divider">|</span>
                <span>Sustainable Energy Analytics</span>
            </div>
        </div>
    `;

    return footer;
}
