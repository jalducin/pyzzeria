/**
 * utils.js — Helpers de formato y utilidades generales
 */

/** Formatea un número como moneda MXN */
export function formatMXN(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(parseFloat(amount) || 0);
}

/** Formatea una fecha ISO a español MX */
export function formatDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Mexico_City'
  }).format(new Date(iso));
}

/** Formatea solo la fecha (sin hora) */
export function formatDateOnly(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric', month: 'short', day: '2-digit',
    timeZone: 'America/Mexico_City'
  }).format(new Date(iso));
}

/** Genera una Idempotency-Key UUID v4 */
export function generateIdempotencyKey() {
  return crypto.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

/** Etiqueta legible del método de pago */
export function paymentMethodLabel(pm) {
  const map = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', qr: 'QR' };
  return map[pm] ?? pm;
}

/** HTML badge para método de pago */
export function paymentMethodBadge(pm) {
  const labels = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', qr: 'QR' };
  return `<span class="pm-badge pm-${pm}">${labels[pm] ?? pm}</span>`;
}

/** Icono SVG del método de pago */
export function paymentMethodIcon(pm) {
  const icons = {
    cash: '💵',
    card: '💳',
    transfer: '🏦',
    qr: '📱'
  };
  return icons[pm] ?? '💰';
}

/** HTML badge de estado de venta */
export function saleStatusBadge(status) {
  const map = {
    completed: ['Completada', 'status-completed'],
    cancelled: ['Cancelada',  'status-cancelled'],
    refunded:  ['Devuelta',   'status-refunded'],
  };
  const [label, cls] = map[status] ?? [status, 'badge-muted'];
  return `<span class="badge ${cls}">${label}</span>`;
}

/** Badge de rol de usuario */
export function roleBadge(role) {
  const map = {
    cashier:    ['Cajero',         'badge-muted'],
    supervisor: ['Supervisor',     'badge-warning'],
    admin:      ['Administrador',  'badge-primary'],
  };
  const [label, cls] = map[role] ?? [role, 'badge-muted'];
  return `<span class="badge ${cls}">${label}</span>`;
}

/** Trunca un UUID a 8 chars para visualización */
export function shortId(uuid) {
  return uuid?.slice(0, 8).toUpperCase() ?? '—';
}

/** Clamp numérico */
export function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}
