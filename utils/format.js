export function money(value) { const n = Number(value || 0); return n.toFixed(n % 1 === 0 ? 0 : 1) }
