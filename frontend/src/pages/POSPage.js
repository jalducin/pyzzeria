/**
 * pages/POSPage.js
 * Pantalla principal de punto de venta para cajeros.
 * Dos columnas: catálogo de productos | carrito + pago.
 */
import { searchProducts, listProducts } from '../api/products.js';
import { createSale } from '../api/sales.js';
import toast from '../components/Toast.js';
import Modal from '../components/Modal.js';
import { formatMXN, formatDate, generateIdempotencyKey, paymentMethodLabel, paymentMethodIcon } from '../utils.js';

export default class POSPage {
  constructor(container) {
    this.container = container;
    this.cart = [];           // [{ product, quantity }]
    this.products = [];
    this.paymentMethod = 'cash';
    this.searchTimeout = null;
    this._submitting = false;
  }

  async render() {
    this.container.innerHTML = `
      <div class="pos-page animate-fade-in">
        <!-- CATÁLOGO -->
        <div class="pos-catalog">
          <div class="pos-search-bar">
            <div class="search-bar" style="flex:1">
              <svg class="search-bar-icon" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input class="form-input" type="search" id="pos-search"
                placeholder="Buscar producto por nombre, SKU o código de barras…"
                autocomplete="off" />
            </div>
            <select class="form-select" id="pos-category" style="width:160px">
              <option value="">Todas las categorías</option>
            </select>
          </div>

          <div class="pos-products-grid" id="pos-products-grid">
            <div class="empty-state" style="grid-column:1/-1">
              <div class="spinner spinner-lg"></div>
            </div>
          </div>
        </div>

        <!-- CARRITO -->
        <div class="pos-cart" id="pos-cart">
          <div class="pos-cart-header">
            <h3>Carrito de venta</h3>
            <div class="flex items-center gap-2">
              <span class="pos-cart-count" id="cart-count">0</span>
              <button class="btn btn-ghost btn-sm" id="clear-cart-btn" title="Vaciar carrito">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="pos-cart-items" id="cart-items">
            <div class="empty-state" style="padding:var(--space-8) 0">
              <svg style="width:40px;height:40px;color:var(--color-text-faint)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M3 3h2l.4 2M7 13h10l4-9H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              <p style="font-size:var(--font-size-sm)">El carrito está vacío</p>
            </div>
          </div>

          <div class="pos-cart-summary" id="cart-summary" style="display:none">
            <div class="summary-row">
              <span class="summary-label">Subtotal</span>
              <span id="summary-subtotal">$0.00</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">IVA (16%)</span>
              <span id="summary-tax">$0.00</span>
            </div>
            <div class="summary-row total">
              <span>Total</span>
              <span id="summary-total">$0.00</span>
            </div>
          </div>

          <div class="pos-payment" id="pos-payment" style="display:none">
            <div style="font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-muted);margin-bottom:var(--space-2)">
              Método de pago
            </div>
            <div class="payment-methods">
              <button class="payment-method-btn selected" data-pm="cash" id="pm-cash">
                <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                Efectivo
              </button>
              <button class="payment-method-btn" data-pm="card" id="pm-card">
                <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                </svg>
                Tarjeta
              </button>
              <button class="payment-method-btn" data-pm="transfer" id="pm-transfer">
                <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                </svg>
                Transferencia
              </button>
              <button class="payment-method-btn" data-pm="qr" id="pm-qr">
                <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                </svg>
                QR
              </button>
            </div>

            <div id="cash-received-group" class="form-group">
              <label class="form-label" for="cash-received">Efectivo recibido</label>
              <input class="form-input" type="number" id="cash-received"
                placeholder="0.00" min="0" step="0.01" />
              <div id="cash-change" class="form-hint" style="display:none">
                Cambio: <strong id="change-amount" style="color:var(--color-success)">$0.00</strong>
              </div>
            </div>

            <button class="btn btn-success btn-lg w-full" id="confirm-sale-btn" disabled>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span id="confirm-sale-text">Confirmar Venta</span>
              <div class="spinner spinner-sm hidden" id="confirm-spinner"></div>
            </button>
          </div>
        </div>
      </div>`;

    await this._loadProducts();
    this._bindEvents();
  }

  async _loadProducts(query = '', category = '') {
    const grid = this.container.querySelector('#pos-products-grid');
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="spinner spinner-lg"></div></div>';

    try {
      let products;
      if (query.length >= 1) {
        products = await searchProducts(query);
      } else {
        products = await listProducts({ category: category || undefined, in_stock: true, limit: 100 });
      }
      this.products = products;
      this._renderProducts(products);

      // Cargar categorías únicas
      if (!query) {
        const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
        const sel = this.container.querySelector('#pos-category');
        const current = sel.value;
        sel.innerHTML = '<option value="">Todas las categorías</option>' +
          cats.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
      }
    } catch (err) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <p class="text-error">Error al cargar productos: ${err.message}</p>
        <button class="btn btn-secondary btn-sm" id="retry-load">Reintentar</button>
      </div>`;
      this.container.querySelector('#retry-load')?.addEventListener('click', () => this._loadProducts());
    }
  }

  _renderProducts(products) {
    const grid = this.container.querySelector('#pos-products-grid');
    if (!products.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>No se encontraron productos</p></div>';
      return;
    }
    grid.innerHTML = products.map(p => `
      <div class="pos-product-card ${p.stock === 0 ? 'out-of-stock' : ''}"
        data-id="${p.id}" data-stock="${p.stock}"
        title="${p.name}">
        <div class="pos-product-name">${p.name}</div>
        <div class="pos-product-price">${formatMXN(p.price)}</div>
        <div class="pos-product-stock">
          ${p.stock === 0 ? '❌ Sin stock' : `📦 Stock: ${p.stock}`}
        </div>
        ${p.stock > 0 ? '<button class="pos-product-add-btn" aria-label="Agregar">+</button>' : ''}
      </div>`).join('');

    grid.querySelectorAll('.pos-product-card:not(.out-of-stock)').forEach(card => {
      card.addEventListener('click', () => {
        const prod = products.find(p => p.id === card.dataset.id);
        if (prod) this._addToCart(prod);
      });
    });
  }

  _addToCart(product) {
    const existing = this.cart.find(i => i.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        toast.warning(`Stock máximo: ${product.stock} unidades`);
        return;
      }
      existing.quantity++;
    } else {
      this.cart.push({ product, quantity: 1 });
    }
    this._renderCart();
    toast.success(`${product.name} agregado`, 1500);
  }

  _removeFromCart(productId) {
    this.cart = this.cart.filter(i => i.product.id !== productId);
    this._renderCart();
  }

  _changeQty(productId, delta) {
    const item = this.cart.find(i => i.product.id === productId);
    if (!item) return;
    item.quantity = Math.max(1, Math.min(item.product.stock, item.quantity + delta));
    this._renderCart();
  }

  _renderCart() {
    const itemsEl = this.container.querySelector('#cart-items');
    const countEl = this.container.querySelector('#cart-count');
    const summaryEl = this.container.querySelector('#cart-summary');
    const paymentEl = this.container.querySelector('#pos-payment');
    const confirmBtn = this.container.querySelector('#confirm-sale-btn');

    countEl.textContent = this.cart.reduce((s, i) => s + i.quantity, 0);

    if (!this.cart.length) {
      itemsEl.innerHTML = `
        <div class="empty-state" style="padding:var(--space-8) 0">
          <svg style="width:40px;height:40px;color:var(--color-text-faint)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M3 3h2l.4 2M7 13h10l4-9H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          <p style="font-size:var(--font-size-sm)">El carrito está vacío</p>
        </div>`;
      summaryEl.style.display = 'none';
      paymentEl.style.display = 'none';
      confirmBtn.disabled = true;
      return;
    }

    itemsEl.innerHTML = this.cart.map(({ product: p, quantity: q }) => {
      const subtotal = p.price * q;
      return `<div class="cart-item" data-id="${p.id}">
        <div class="cart-item-info">
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-price">${formatMXN(p.price)} c/u</div>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn" data-action="dec" data-id="${p.id}">−</button>
          <span class="qty-value">${q}</span>
          <button class="qty-btn" data-action="inc" data-id="${p.id}">+</button>
        </div>
        <div class="cart-item-subtotal">${formatMXN(subtotal)}</div>
        <button class="cart-item-remove" data-id="${p.id}" aria-label="Eliminar">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>`;
    }).join('');

    // Bind qty buttons
    itemsEl.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = btn.dataset.action === 'inc' ? 1 : -1;
        this._changeQty(btn.dataset.id, delta);
      });
    });
    itemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => this._removeFromCart(btn.dataset.id));
    });

    // Calcular totales (IVA incluido en el precio — modelo: precio ya lleva IVA)
    // Según SDD CA-01.3: total = subtotal + IVA 16%
    const subtotalNet = this.cart.reduce((s, i) => s + (parseFloat(i.product.price) * i.quantity), 0);
    const tax = subtotalNet * 0.16;
    const total = subtotalNet + tax;

    this.container.querySelector('#summary-subtotal').textContent = formatMXN(subtotalNet);
    this.container.querySelector('#summary-tax').textContent = formatMXN(tax);
    this.container.querySelector('#summary-total').textContent = formatMXN(total);

    summaryEl.style.display = '';
    paymentEl.style.display = '';

    this._updateCashChange();
    this._updateConfirmBtn();
  }

  _updateCashChange() {
    const cashInput = this.container.querySelector('#cash-received');
    const changeDiv = this.container.querySelector('#cash-change');
    const changeAmt = this.container.querySelector('#change-amount');
    const total = this._getTotal();

    if (this.paymentMethod !== 'cash') {
      changeDiv.style.display = 'none';
      return;
    }

    const received = parseFloat(cashInput?.value ?? 0) || 0;
    if (received > 0 && received >= total) {
      const change = received - total;
      changeAmt.textContent = formatMXN(change);
      changeDiv.style.display = '';
    } else {
      changeDiv.style.display = 'none';
    }
  }

  _getTotal() {
    const subtotal = this.cart.reduce((s, i) => s + (parseFloat(i.product.price) * i.quantity), 0);
    return subtotal * 1.16;
  }

  _updateConfirmBtn() {
    const confirmBtn = this.container.querySelector('#confirm-sale-btn');
    const cashInput = this.container.querySelector('#cash-received');
    let canConfirm = this.cart.length > 0;

    if (this.paymentMethod === 'cash') {
      const received = parseFloat(cashInput?.value ?? 0) || 0;
      canConfirm = canConfirm && received >= this._getTotal();
    }

    confirmBtn.disabled = !canConfirm || this._submitting;
  }

  _bindEvents() {
    // Búsqueda con debounce
    this.container.querySelector('#pos-search').addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        const cat = this.container.querySelector('#pos-category').value;
        this._loadProducts(e.target.value.trim(), cat);
      }, 300);
    });

    // Filtro de categoría
    this.container.querySelector('#pos-category').addEventListener('change', (e) => {
      const q = this.container.querySelector('#pos-search').value.trim();
      this._loadProducts(q, e.target.value);
    });

    // Limpiar carrito
    this.container.querySelector('#clear-cart-btn').addEventListener('click', () => {
      if (!this.cart.length) return;
      this.cart = [];
      this._renderCart();
    });

    // Métodos de pago
    this.container.querySelectorAll('.payment-method-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.paymentMethod = btn.dataset.pm;
        const cashGroup = this.container.querySelector('#cash-received-group');
        cashGroup.style.display = this.paymentMethod === 'cash' ? '' : 'none';
        this._updateCashChange();
        this._updateConfirmBtn();
      });
    });

    // Efectivo recibido
    this.container.querySelector('#cash-received').addEventListener('input', () => {
      this._updateCashChange();
      this._updateConfirmBtn();
    });

    // Confirmar venta
    this.container.querySelector('#confirm-sale-btn').addEventListener('click', () => this._confirmSale());
  }

  async _confirmSale() {
    if (this._submitting || !this.cart.length) return;
    this._submitting = true;
    this._setSubmitting(true);

    const cashInput = this.container.querySelector('#cash-received');
    const payload = {
      items: this.cart.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
      payment_method: this.paymentMethod,
      cash_received: this.paymentMethod === 'cash' ? parseFloat(cashInput.value) : null
    };

    const idempotencyKey = generateIdempotencyKey();

    try {
      const sale = await createSale(payload, idempotencyKey);
      this._showTicket(sale);
      this.cart = [];
      this._renderCart();
      toast.success('Venta registrada exitosamente');
    } catch (err) {
      if (err.code === 'STOCK_INSUFFICIENT') {
        toast.error(`Stock insuficiente: ${err.details?.sku ?? ''} — disponible: ${err.details?.available ?? 0}`);
      } else if (err.code === 'PAYMENT_DECLINED') {
        toast.error('Pago rechazado por la terminal. Intenta con otro método.');
      } else {
        toast.error(`Error: ${err.message}`);
      }
    } finally {
      this._submitting = false;
      this._setSubmitting(false);
    }
  }

  _setSubmitting(val) {
    const btn = this.container.querySelector('#confirm-sale-btn');
    const text = this.container.querySelector('#confirm-sale-text');
    const spinner = this.container.querySelector('#confirm-spinner');
    btn.disabled = val;
    text.textContent = val ? 'Procesando…' : 'Confirmar Venta';
    spinner.classList.toggle('hidden', !val);
  }

  _showTicket(sale) {
    const subtotal = parseFloat(sale.subtotal);
    const tax = parseFloat(sale.tax);
    const total = parseFloat(sale.total);
    const change = sale.change_given ? parseFloat(sale.change_given) : null;

    const modal = new Modal({
      title: '✅ Venta Confirmada',
      size: 'modal-lg',
      content: `
        <div class="ticket">
          <div class="ticket-header">
            <div class="ticket-title">POS RETAIL</div>
            <div class="ticket-subtitle">Ticket de Venta</div>
            <div class="ticket-subtitle">${formatDate(sale.created_at)}</div>
            <div class="ticket-subtitle">Folio: ${sale.id.slice(0, 8).toUpperCase()}</div>
          </div>
          <div class="ticket-items">
            ${this.cart.map(({ product: p, quantity: q }) => `
              <div class="ticket-item">
                <div class="ticket-item-name">${p.name}</div>
                <div class="ticket-item-detail">${q} x ${formatMXN(p.price)} = ${formatMXN(parseFloat(p.price) * q)}</div>
              </div>`).join('')}
          </div>
          <div class="ticket-row"><span>Subtotal</span><span>${formatMXN(subtotal)}</span></div>
          <div class="ticket-row"><span>IVA (16%)</span><span>${formatMXN(tax)}</span></div>
          <div class="ticket-row ticket-total"><span>TOTAL</span><span>${formatMXN(total)}</span></div>
          ${change !== null ? `<div class="ticket-row" style="margin-top:8px"><span>Efectivo</span><span>${formatMXN(sale.cash_received)}</span></div>` : ''}
          ${change !== null ? `<div class="ticket-row"><span>Cambio</span><span style="color:#22c55e;font-weight:700">${formatMXN(change)}</span></div>` : ''}
          <div class="ticket-footer">¡Gracias por su compra!<br>Método: ${paymentMethodLabel(sale.payment_method)}</div>
        </div>`,
      footer: `<button class="btn btn-secondary" id="ticket-close">Cerrar</button>
               <button class="btn btn-primary" id="ticket-print" onclick="window.print()">Imprimir</button>`
    });
    modal.open();
    document.getElementById('ticket-close')?.addEventListener('click', () => modal.close());
  }

  destroy() {
    clearTimeout(this.searchTimeout);
  }
}
