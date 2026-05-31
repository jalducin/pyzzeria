/**
 * pages/RefundsPage.js — Devoluciones (Supervisor+)
 */
import { listSales, refundSale } from '../api/sales.js';
import toast from '../components/Toast.js';
import { formatMXN, formatDate, shortId, saleStatusBadge } from '../utils.js';

export default class RefundsPage {
  constructor(container) {
    this.container = container;
    this.selectedSale = null;
  }

  async render() {
    // Leer sale_id de la URL si viene redirigido desde historial
    const hash = window.location.hash;
    const saleIdParam = new URLSearchParams(hash.split('?')[1] ?? '').get('sale_id');

    this.container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div>
            <h1>Devoluciones</h1>
            <p class="text-muted text-sm mt-2">Busca una venta y procesa la devolución total o parcial</p>
          </div>
        </div>

        <!-- Búsqueda de venta -->
        <div class="card mb-6">
          <div class="card-header">
            <h3>Buscar Venta</h3>
          </div>
          <div class="flex gap-3 items-center">
            <div class="search-bar" style="flex:1">
              <svg class="search-bar-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input class="form-input" id="sale-search-input"
                placeholder="ID de venta o folio…"
                value="${saleIdParam ?? ''}" />
            </div>
            <button class="btn btn-primary" id="search-sale-btn">Buscar</button>
          </div>
          <div id="sale-search-result" class="mt-4"></div>
        </div>

        <!-- Formulario de devolución -->
        <div id="refund-form-section" class="card hidden">
          <div class="card-header">
            <h3 id="refund-sale-title">Devolución</h3>
            <span id="refund-sale-status"></span>
          </div>
          <div id="refund-items-list"></div>
          <div class="form-group mt-4">
            <label class="form-label" for="refund-reason">Motivo de devolución</label>
            <textarea class="form-textarea" id="refund-reason" placeholder="Describe el motivo de la devolución…" rows="3"></textarea>
          </div>
          <div id="refund-error" class="form-error mt-2 hidden"></div>
          <div class="flex gap-3 justify-between mt-6">
            <button class="btn btn-secondary" id="refund-cancel-btn">Cancelar</button>
            <button class="btn btn-danger btn-lg" id="refund-confirm-btn">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
              </svg>
              <span id="refund-confirm-text">Procesar Devolución</span>
            </button>
          </div>
        </div>
      </div>`;

    this._bindEvents();

    if (saleIdParam) {
      this.container.querySelector('#sale-search-input').value = saleIdParam;
      await this._searchSale(saleIdParam);
    }
  }

  _bindEvents() {
    this.container.querySelector('#search-sale-btn').addEventListener('click', async () => {
      const val = this.container.querySelector('#sale-search-input').value.trim();
      if (val) await this._searchSale(val);
    });
    this.container.querySelector('#sale-search-input').addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (val) await this._searchSale(val);
      }
    });
    this.container.querySelector('#refund-cancel-btn').addEventListener('click', () => {
      this.selectedSale = null;
      this.container.querySelector('#refund-form-section').classList.add('hidden');
      this.container.querySelector('#sale-search-result').innerHTML = '';
      this.container.querySelector('#sale-search-input').value = '';
    });
    this.container.querySelector('#refund-confirm-btn').addEventListener('click', () => this._processRefund());
  }

  async _searchSale(query) {
    const resultEl = this.container.querySelector('#sale-search-result');
    resultEl.innerHTML = '<div class="spinner"></div>';

    try {
      // Buscar en la lista de ventas completadas
      const sales = await listSales({ status: 'completed' });
      const sale = sales.find(s => s.id === query || s.id.startsWith(query) || shortId(s.id) === query.toUpperCase());

      if (!sale) {
        resultEl.innerHTML = `<p class="text-error text-sm">Venta no encontrada o no está en estado "Completada".</p>`;
        this.container.querySelector('#refund-form-section').classList.add('hidden');
        return;
      }

      resultEl.innerHTML = `
        <div class="card" style="background:var(--color-surface-2)">
          <div class="flex justify-between items-center">
            <div>
              <div class="font-semibold">${shortId(sale.id)} — ${formatMXN(sale.total)}</div>
              <div class="text-sm text-muted">${formatDate(sale.created_at)}</div>
            </div>
            ${saleStatusBadge(sale.status)}
          </div>
        </div>`;

      this.selectedSale = sale;
      this._showRefundForm(sale);
    } catch (err) {
      resultEl.innerHTML = `<p class="text-error text-sm">${err.message}</p>`;
    }
  }

  _showRefundForm(sale) {
    const section = this.container.querySelector('#refund-form-section');
    this.container.querySelector('#refund-sale-title').textContent = `Devolución — Venta ${shortId(sale.id)}`;
    this.container.querySelector('#refund-sale-status').innerHTML = saleStatusBadge(sale.status);

    // Mostrar items con checkboxes y cantidades (simulado, ya que el GET /sales/{id} debería devolver items)
    const itemsEl = this.container.querySelector('#refund-items-list');
    itemsEl.innerHTML = `
      <div class="card" style="background:var(--color-surface-2);margin-bottom:var(--space-4)">
        <p class="text-sm text-muted mb-3">Indica los ítems y cantidades a devolver:</p>
        <div class="form-group">
          <label class="form-label">Tipo de devolución</label>
          <select class="form-select" id="refund-type">
            <option value="full">Devolución total (${formatMXN(sale.total)})</option>
            <option value="partial">Devolución parcial</option>
          </select>
        </div>
        <div id="partial-refund-fields" class="mt-4 hidden">
          <p class="text-sm text-muted">
            Para devoluciones parciales, especifica los IDs de los ítems de venta.
            Puedes obtenerlos en el detalle de la venta vía API.
          </p>
          <div class="form-group mt-3">
            <label class="form-label" for="partial-items-json">Items (JSON)</label>
            <textarea class="form-textarea form-input" id="partial-items-json" rows="3"
              placeholder='[{"sale_item_id": "uuid", "quantity": 1}]'></textarea>
          </div>
        </div>
      </div>`;

    itemsEl.querySelector('#refund-type').addEventListener('change', (e) => {
      const partial = itemsEl.querySelector('#partial-refund-fields');
      partial.classList.toggle('hidden', e.target.value !== 'partial');
    });

    section.classList.remove('hidden');
    section.scrollIntoView({ behavior: 'smooth' });
  }

  async _processRefund() {
    if (!this.selectedSale) return;

    const reason = this.container.querySelector('#refund-reason').value.trim();
    const refundType = this.container.querySelector('#refund-type')?.value ?? 'full';
    const errEl = this.container.querySelector('#refund-error');
    const confirmBtn = this.container.querySelector('#refund-confirm-btn');
    const confirmText = this.container.querySelector('#refund-confirm-text');

    errEl.classList.add('hidden');

    let items = [];
    if (refundType === 'partial') {
      try {
        const raw = this.container.querySelector('#partial-items-json')?.value ?? '[]';
        items = JSON.parse(raw);
        if (!Array.isArray(items) || !items.length) throw new Error('Lista vacía');
      } catch {
        errEl.textContent = 'JSON de ítems inválido. Formato: [{"sale_item_id": "uuid", "quantity": 1}]';
        errEl.classList.remove('hidden');
        return;
      }
    }

    // Para devolución total, enviar vacío (backend lo interpreta como total)
    const payload = { items, reason: reason || null };

    confirmBtn.disabled = true;
    confirmText.textContent = 'Procesando…';

    try {
      await refundSale(this.selectedSale.id, payload);
      toast.success('Devolución procesada. Nota de crédito emitida.');
      this.container.querySelector('#refund-cancel-btn').click();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      confirmBtn.disabled = false;
      confirmText.textContent = 'Procesar Devolución';
    }
  }

  destroy() {}
}
