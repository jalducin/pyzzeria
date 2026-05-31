/**
 * pages/ReportsPage.js — Dashboard de reportes (Supervisor+)
 */
import { getDailyReport, getTopProducts, getCashierReport } from '../api/reports.js';
import toast from '../components/Toast.js';
import { formatMXN, formatDateOnly, paymentMethodLabel } from '../utils.js';

export default class ReportsPage {
  constructor(container) {
    this.container = container;
    this.activeTab = 'daily';
  }

  async render() {
    const today = new Date().toISOString().slice(0, 10);

    this.container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div>
            <h1>Reportes</h1>
            <p class="text-muted text-sm mt-2">Analiza el desempeño de ventas de la tienda</p>
          </div>
        </div>

        <div class="tabs">
          <button class="tab-btn active" data-tab="daily">Corte del Día</button>
          <button class="tab-btn" data-tab="top">Top Productos</button>
          <button class="tab-btn" data-tab="cashier">Por Cajero</button>
        </div>

        <!-- TAB: Corte del día -->
        <div id="tab-daily" class="tab-content">
          <div class="flex gap-3 items-center mb-5 flex-wrap">
            <div class="form-group" style="flex:1;max-width:200px">
              <label class="form-label" for="daily-date">Fecha</label>
              <input class="form-input" type="date" id="daily-date" value="${today}" />
            </div>
            <button class="btn btn-primary" id="load-daily-btn" style="margin-top:1.2rem">
              Consultar
            </button>
          </div>
          <div id="daily-content">
            <div class="empty-state">
              <p>Selecciona una fecha y presiona "Consultar"</p>
            </div>
          </div>
        </div>

        <!-- TAB: Top productos -->
        <div id="tab-top" class="tab-content hidden">
          <div class="flex gap-3 items-center mb-5 flex-wrap">
            <div class="form-group">
              <label class="form-label" for="top-from">Desde</label>
              <input class="form-input" type="date" id="top-from" />
            </div>
            <div class="form-group">
              <label class="form-label" for="top-to">Hasta</label>
              <input class="form-input" type="date" id="top-to" value="${today}" />
            </div>
            <button class="btn btn-primary" id="load-top-btn" style="margin-top:1.2rem">
              Consultar
            </button>
          </div>
          <div id="top-content">
            <div class="empty-state"><p>Define el rango y presiona "Consultar"</p></div>
          </div>
        </div>

        <!-- TAB: Por cajero -->
        <div id="tab-cashier" class="tab-content hidden">
          <div class="flex gap-3 items-center mb-5 flex-wrap">
            <div class="form-group" style="flex:1;max-width:260px">
              <label class="form-label" for="cashier-id-input">UUID del Cajero</label>
              <input class="form-input" id="cashier-id-input" placeholder="xxxxxxxx-xxxx-…" />
            </div>
            <div class="form-group">
              <label class="form-label" for="cashier-date">Fecha</label>
              <input class="form-input" type="date" id="cashier-date" value="${today}" />
            </div>
            <button class="btn btn-primary" id="load-cashier-btn" style="margin-top:1.2rem">
              Consultar
            </button>
          </div>
          <div id="cashier-content">
            <div class="empty-state"><p>Ingresa el ID del cajero y presiona "Consultar"</p></div>
          </div>
        </div>
      </div>`;

    this._bindTabs();
    this._bindButtons();
  }

  _bindTabs() {
    this.container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.container.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.container.querySelector(`#tab-${this.activeTab}`).classList.remove('hidden');
      });
    });
  }

  _bindButtons() {
    this.container.querySelector('#load-daily-btn').addEventListener('click', () => this._loadDaily());
    this.container.querySelector('#load-top-btn').addEventListener('click', () => this._loadTopProducts());
    this.container.querySelector('#load-cashier-btn').addEventListener('click', () => this._loadCashier());
  }

  async _loadDaily() {
    const date = this.container.querySelector('#daily-date').value;
    const el = this.container.querySelector('#daily-content');
    el.innerHTML = '<div class="empty-state"><div class="spinner spinner-lg"></div></div>';

    try {
      const data = await getDailyReport(date);
      el.innerHTML = this._renderDailyReport(data, date);
    } catch (err) {
      el.innerHTML = this._renderApiNote(err.message);
    }
  }

  _renderDailyReport(data, date) {
    // Shape del backend (GET /reports/daily):
    //   { date, timezone, totals: {tickets, amount}, by_payment_method: { cash: {count, amount}, ... } }
    const total = parseFloat(data?.totals?.amount ?? 0);
    const count = data?.totals?.tickets ?? 0;
    const byPM = data?.by_payment_method ?? {};

    return `
      <div class="reports-stats">
        <div class="stat-card">
          <div class="stat-label">Total Ventas</div>
          <div class="stat-value">${formatMXN(total)}</div>
          <div class="stat-sub">${formatDateOnly(date + 'T12:00:00')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Transacciones</div>
          <div class="stat-value">${count}</div>
          <div class="stat-sub">ventas completadas</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Ticket Promedio</div>
          <div class="stat-value">${count > 0 ? formatMXN(total / count) : '$0.00'}</div>
        </div>
      </div>

      ${Object.keys(byPM).length > 0 ? `
      <div class="report-chart mt-6">
        <h3>Ventas por Método de Pago</h3>
        <div class="bar-chart">
          ${Object.entries(byPM).map(([pm, val]) => {
            const amount = parseFloat(val?.amount ?? 0);
            const pct = total > 0 ? (amount / total * 100).toFixed(1) : 0;
            return `<div class="bar-row">
              <div class="bar-label">${paymentMethodLabel(pm)} <span class="text-xs text-muted">(${val.count})</span></div>
              <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
              <div class="bar-value">${formatMXN(amount)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}`;
  }

  async _loadTopProducts() {
    const from = this.container.querySelector('#top-from').value;
    const to = this.container.querySelector('#top-to').value;
    const el = this.container.querySelector('#top-content');
    el.innerHTML = '<div class="empty-state"><div class="spinner spinner-lg"></div></div>';

    try {
      const data = await getTopProducts(from || undefined, to || undefined);
      el.innerHTML = this._renderTopProducts(data);
    } catch (err) {
      el.innerHTML = this._renderApiNote(err.message);
    }
  }

  _renderTopProducts(data) {
    const items = Array.isArray(data) ? data : (data?.items ?? []);
    if (!items.length) return '<div class="empty-state"><p>Sin datos en el período</p></div>';

    const max = Math.max(...items.map(i => i.units_sold ?? i.quantity ?? 1));
    return `
      <div class="report-chart">
        <h3>Productos más vendidos</h3>
        <div class="bar-chart">
          ${items.slice(0, 10).map(item => {
            const units = item.units_sold ?? item.quantity ?? 0;
            const pct = max > 0 ? (units / max * 100).toFixed(1) : 0;
            return `<div class="bar-row">
              <div class="bar-label">${item.name ?? item.product_name ?? '—'}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
              <div class="bar-value">${units} uds</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  async _loadCashier() {
    const id = this.container.querySelector('#cashier-id-input').value.trim();
    const date = this.container.querySelector('#cashier-date').value;
    const el = this.container.querySelector('#cashier-content');

    if (!id) { toast.warning('Ingresa el ID del cajero'); return; }

    el.innerHTML = '<div class="empty-state"><div class="spinner spinner-lg"></div></div>';

    try {
      const data = await getCashierReport(id, date || undefined);
      el.innerHTML = this._renderCashierReport(data);
    } catch (err) {
      el.innerHTML = this._renderApiNote(err.message);
    }
  }

  _renderCashierReport(data) {
    const total = data?.total_collected ?? 0;
    const tickets = data?.ticket_count ?? 0;
    const refunds = data?.refund_count ?? 0;
    const byPM = data?.by_payment_method ?? {};

    return `
      <div class="reports-stats">
        <div class="stat-card">
          <div class="stat-label">Total Cobrado</div>
          <div class="stat-value">${formatMXN(total)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tickets</div>
          <div class="stat-value">${tickets}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Devoluciones</div>
          <div class="stat-value" style="color:var(--color-warning)">${refunds}</div>
        </div>
      </div>
      ${Object.keys(byPM).length > 0 ? `
      <div class="report-chart mt-6">
        <h3>Por Método de Pago</h3>
        <div class="bar-chart">
          ${Object.entries(byPM).map(([pm, val]) => {
            const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
            return `<div class="bar-row">
              <div class="bar-label">${paymentMethodLabel(pm)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
              <div class="bar-value">${formatMXN(val)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}`;
  }

  _renderApiNote(errMsg) {
    return `
      <div class="card" style="border-color:var(--color-warning);background:var(--color-warning-soft)">
        <div class="flex gap-3 items-center">
          <svg width="20" height="20" style="color:var(--color-warning);flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <div>
            <div class="font-semibold" style="color:var(--color-warning)">Endpoint pendiente de implementación</div>
            <div class="text-sm text-muted">${errMsg} — Este endpoint corresponde al Sprint 4 del SDD (tasks.md T4-05..T4-07).</div>
          </div>
        </div>
      </div>`;
  }

  destroy() {}
}
