// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Formatters
// ═══════════════════════════════════════════════════════

export function formatNumber(value, decimals = 1) {
    if (value == null || isNaN(value)) return '–';
    return value.toFixed(decimals);
}

export function formatPrice(value) {
    if (value == null || isNaN(value)) return '–';
    return value.toFixed(2);
}

export function formatDeviation(value) {
    if (value == null || isNaN(value)) return '–';
    const prefix = value >= 0 ? '+' : '';
    return prefix + value.toFixed(2);
}

export function eurToBgn(eur) {
    return eur * 1.9558;
}

export function formatHour(date) {
    const h = date.getHours().toString().padStart(2, '0');
    return `${h}:00`;
}

export function formatDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
}

export function formatDateFull(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}
