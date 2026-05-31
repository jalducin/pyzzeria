/**
 * pages/SalesHistoryPage.js — Historial de ventas (Supervisor+)
 */
import { listSales } from '../api/sales.js';
import DataTable from '../components/DataTable.js';
import Modal from '../components/Modal.js';
import toast from '../components/Toast.js';
import { formatMXN, formatDate, shortId, paymentMethodBadge, saleStatusBadge } from '../utils.js';

export default class SalesHistoryPage {
  constructor(container) {
    this.container = container;
    this.sales = [];
    this.table = null;
  }

  async render() {
    this.container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div>
            <h1>Historial de Ventas</h1>
            <p class="text-muted text-sm mt-2">Consulta y gestiona todas las ventas realizadas</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="refresh-sales-btn">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Actualizar
          </button>
        </div>

        <div class="filters-bar">
          <select class="form-select" id="sales-status" style="width:160px">
            <option value="">Todos los estados</option>
            <option value="completed">Completadas</option>
            <option value="cancelled">Canceladas</option>
            <option value="refunded">Devueltas</option>
          </select>
          <select class="form-select" id="sales-pm" style="width:160px">
            <option value="">Todos los métodos</option>
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="transfer">Transferencia</option>
            <option value="qr">QR</option>
          </select>
        </div>

        <div id="sales-table-container"></div>
      </div>`;

    await this._loadSales();
    this._bindEvents();
  }

  async _loadSales() {
    try {
      const params = {};
      const status = this.container.querySelector('#sales-status')?.value;
      const pm = this.container.querySelector('#sales-pm')?.value;
      if (status) params.status = status;
      if (pm) params.payment_method = pm;

      this.sales = await listSales(params);
      this._renderTable();
    } catch (err) {
      toast.error(`Error al cargar ventas: ${err.message}`);
    }
  }

  _renderTable() {
    const container = this.container.querySelector('#sales-table-container');

    this.table = new DataTable(container, {
      columns: [
        { key: 'id', label: 'Folio', render: r => `<span class="font-mono text-xs">${shortId(r.id)}</span>` },
        { key: 'created_at', label: 'Fecha', render: r => formatDate(r.created_at) },
        { key: 'payment_method', label: 'Método', render: r => paymentMethodBadge(r.payment_method) },
        { key: 'subtotal', label: 'Subtotal', render: r => formatMXN(r.subtotal) },
        { key: 'tax', label: 'IVA', render: r => formatMXN(r.tax) },
        { key: 'total', label: 'Total', render: r => `<strong style="color:var(--color-text)">${formatMXN(r.total)}</strong>` },
        { key: 'status', label: 'Estado', render: r => saleStatusBadge(r.status) },
        { key: 'actions', label: '', render: r => r.status === 'completed'
          ? `<a href="#/refunds?sale_id=${r.id}" class="btn btn-ghost btn-sm">Devolver</a>`
          : '' }
      ],
      data: this.sales,
      pageSize: 25,
      onRowClick: (row) => this._showSaleDetail(row),
      emptyMsg: 'No se encontraron ventas'
    });
    this.table.render();
  }

  _showSaleDetail(sale) {
    const modal = new Modal({
      title: `Venta — ${shortId(sale.id)}`,
      size: 'modal-lg',
      content: `
        <div class="flex gap-6 flex-col">
          <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
            <div class="stat-card">
              <div class="stat-label">Total</div>
              <div class="stat-value" style="font-size:var(--font-size-2xl)">${formatMXN(sale.total)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Estado</div>
              <div class="stat-value" style="font-size:var(--font-size-xl)">${saleStatusBadge(sale.status)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Método</div>
              <div class="stat-value" style="font-size:var(--font-size-xl)">${paymentMethodBadge(sale.payment_method)}</div>
            </div>
          </div>
          <div>
            <div class="text-sm text-muted mb-2">Fecha: ${formatDate(sale.created_at)}</div>
            ${sale.cash_received ? `<div class="text-sm text-muted">Efectivo recibido: ${formatMXN(sale.cash_received)}</div>` : ''}
            ${sale.change_given ? `<div class="text-sm text-muted">Cambio: ${formatMXN(sale.change_given)}</div>` : ''}
          </div>
          ${sale.status === 'completed' ? `
            <a href="#/refunds?sale_id=${sale.id}" class="btn btn-danger btn-sm" style="align-self:flex-start">
              Procesar Devolución
            </a>` : ''}
        </div>`,
      footer: `<button class="btn btn-secondary" id="close-detail-btn">Cerrar</button>`
    });
    modal.open();
    document.getElementById('close-detail-btn')?.addEventListener('click', () => modal.close());
  }

  _bindEvents() {
    this.container.querySelector('#refresh-sales-btn').addEventListener('click', () => this._loadSales());
    this.container.querySelector('#sales-status').addEventListener('change', () => this._loadSales());
    this.container.querySelector('#sales-pm').addEventListener('change', () => this._loadSales());
  }

  destroy() {}
}
