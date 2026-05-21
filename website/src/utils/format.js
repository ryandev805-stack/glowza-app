export function money(value) {
  return `PKR ${Number(value || 0).toLocaleString('en-PK')}`;
}

export function initials(name) {
  return String(name || 'Glowza')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function discountPercent(price, oldPrice) {
  const current = Number(price || 0);
  const previous = Number(oldPrice || 0);
  if (!previous || previous <= current) return 0;
  return Math.round(((previous - current) / previous) * 100);
}
