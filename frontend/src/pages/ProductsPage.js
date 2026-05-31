/**
 * pages/ProductsPage.js — CRUD de productos (Admin)
 */
import { listProducts, createProduct, updateProduct, deleteProduct } from '../api/products.js';
import DataTable from '../components/DataTable.js';
import Modal from '../components/Modal.js';
import toast from '../components/Toast.js';
import { formatMXN, formatDate } from '../utils.js';

export default class ProductsPage {
  constructor(container) {
    this.container = container;
    this.products = [];
    this.table = null;
    this._filter = { search: '', category: '', in_stock: '' };
  }

  async render() {
    this.container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div>
            <h1>Gestión de Productos</h1>
            <p class="text-muted text-sm mt-2">Administra el catálogo de productos de la tienda</p>
          </div>
          <div class="page-header-actions">
            <button class="btn btn-primary" id="new-product-btn">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Nuevo Producto
            </button>
          </div>
        </div>

        <div class="filters-bar">
          <div class="search-bar" style="flex:1;max-width:320px">
            <svg class="search-bar-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input class="form-input" type="search" id="prod-search" placeholder="Buscar por nombre o SKU…" />
          </div>
          <select class="form-select" id="prod-category" style="width:160px">
            <option value="">Todas las categorías</option>
          </select>
          <select class="form-select" id="prod-stock" style="width:140px">
            <option value="">Todo el stock</option>
            <option value="true">Con stock</option>
            <option value="false">Sin stock</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="refresh-btn">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Actualizar
          </button>
        </div>

        <div id="products-table-container"></div>
      </div>`;

    await this._loadProducts();
    this._bindEvents();
  }

  async _loadProducts() {
    try {
      this.products = await listProducts({ limit: 200 });
      this._refreshTable();
      this._refreshCategories();
    } catch (err) {
      toast.error(`Error al cargar productos: ${err.message}`);
    }
  }

  _refreshCategories() {
    const cats = [...new Set(this.products.map(p => p.category).filter(Boolean))].sort();
    const sel = this.container.querySelector('#prod-category');
    const current = sel.value;
    sel.innerHTML = '<option value="">Todas las categorías</option>' +
      cats.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
  }

  _getFilteredProducts() {
    const { search, category, in_stock } = this._filter;
    return this.products.filter(p => {
      if (search && !p.name.toLowerCase().includes(search) && !p.sku.toLowerCase().includes(search)) return false;
      if (category && p.category !== category) return false;
      if (in_stock === 'true' && p.stock <= 0) return false;
      if (in_stock === 'false' && p.stock > 0) return false;
      return true;
    });
  }

  _refreshTable() {
    const container = this.container.querySelector('#products-table-container');
    const data = this._getFilteredProducts();

    if (!this.table) {
      this.table = new DataTable(container, {
        columns: [
          { key: 'sku', label: 'SKU', width: '100px' },
          { key: 'name', label: 'Nombre' },
          { key: 'category', label: 'Categoría', render: r => r.category ?? '—' },
          { key: 'price', label: 'Precio', render: r => `<strong>${formatMXN(r.price)}</strong>` },
          { key: 'stock', label: 'Stock', render: r => {
            const cls = r.stock === 0 ? 'text-error' : r.stock < 10 ? 'text-warning' : 'text-success';
            return `<span class="font-semibold ${cls}">${r.stock}</span>`;
          }},
          { key: 'is_active', label: 'Estado', render: r => r.is_active
            ? '<span class="badge badge-success">Activo</span>'
            : '<span class="badge badge-error">Inactivo</span>' },
          { key: 'actions', label: 'Acciones', render: r => `
            <div class="flex gap-2">
              <button class="btn btn-secondary btn-sm edit-btn" data-id="${r.id}">Editar</button>
              <button class="btn btn-danger btn-sm del-btn" data-id="${r.id}" ${!r.is_active ? 'disabled' : ''}>
                Desactivar
              </button>
            </div>` }
        ],
        data,
        emptyMsg: 'No se encontraron productos'
      });
    } else {
      this.table.setData(data);
    }

    this.table.render();
    this._bindTableActions();
  }

  _bindTableActions() {
    this.container.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const prod = this.products.find(p => p.id === btn.dataset.id);
        if (prod) this._openProductModal(prod);
      });
    });
    this.container.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('¿Desactivar este producto? Seguirá visible en el historial de ventas.')) return;
        try {
          await deleteProduct(btn.dataset.id);
          toast.success('Producto desactivado');
          await this._loadProducts();
        } catch (err) { toast.error(err.message); }
      });
    });
  }

  _bindEvents() {
    this.container.querySelector('#new-product-btn').addEventListener('click', () => this._openProductModal(null));
    this.container.querySelector('#refresh-btn').addEventListener('click', () => this._loadProducts());
    this.container.querySelector('#prod-search').addEventListener('input', (e) => {
      this._filter.search = e.target.value.toLowerCase();
      this._refreshTable();
    });
    this.container.querySelector('#prod-category').addEventListener('change', (e) => {
      this._filter.category = e.target.value;
      this._refreshTable();
    });
    this.container.querySelector('#prod-stock').addEventListener('change', (e) => {
      this._filter.in_stock = e.target.value;
      this._refreshTable();
    });
  }

  _openProductModal(prod) {
    const isNew = !prod;
    const modal = new Modal({
      title: isNew ? 'Nuevo Producto' : 'Editar Producto',
      size: 'modal-lg',
      content: `
        <form id="product-form" novalidate>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="f-sku">SKU *</label>
              <input class="form-input" id="f-sku" name="sku" value="${prod?.sku ?? ''}" ${!isNew ? 'readonly' : ''} required />
            </div>
            <div class="form-group">
              <label class="form-label" for="f-barcode">Código de barras</label>
              <input class="form-input" id="f-barcode" name="barcode" value="${prod?.barcode ?? ''}" />
            </div>
            <div class="form-group" style="grid-column:1/-1">
              <label class="form-label" for="f-name">Nombre *</label>
              <input class="form-input" id="f-name" name="name" value="${prod?.name ?? ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="f-price">Precio (MXN) *</label>
              <input class="form-input" id="f-price" name="price" type="number" min="0.01" step="0.01" value="${prod?.price ?? ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="f-stock">Stock *</label>
              <input class="form-input" id="f-stock" name="stock" type="number" min="0" value="${prod?.stock ?? 0}" required />
            </div>
            <div class="form-group" style="grid-column:1/-1">
              <label class="form-label" for="f-category">Categoría</label>
              <input class="form-input" id="f-category" name="category" value="${prod?.category ?? ''}" />
            </div>
          </div>
          <div id="prod-form-error" class="form-error mt-4 hidden"></div>
        </form>`,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" id="modal-save-btn">
          ${isNew ? 'Crear Producto' : 'Guardar Cambios'}
        </button>`
    });
    modal.open();

    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => modal.close());
    document.getElementById('modal-save-btn')?.addEventListener('click', async () => {
      const form = document.getElementById('product-form');
      const errEl = document.getElementById('prod-form-error');
      errEl.classList.add('hidden');

      const data = {
        sku:      form.sku.value.trim(),
        name:     form.name.value.trim(),
        price:    parseFloat(form.price.value),
        stock:    parseInt(form.stock.value, 10),
        category: form.category.value.trim() || null,
        barcode:  form.barcode.value.trim() || null,
      };

      if (!data.sku || !data.name || !data.price || data.price <= 0) {
        errEl.textContent = 'Completa los campos obligatorios (SKU, nombre, precio > 0)';
        errEl.classList.remove('hidden');
        return;
      }

      const saveBtn = document.getElementById('modal-save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando…';

      try {
        if (isNew) {
          await createProduct(data);
          toast.success('Producto creado exitosamente');
        } else {
          await updateProduct(prod.id, { name: data.name, price: data.price, stock: data.stock, category: data.category });
          toast.success('Producto actualizado');
        }
        modal.close();
        await this._loadProducts();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
        saveBtn.disabled = false;
        saveBtn.textContent = isNew ? 'Crear Producto' : 'Guardar Cambios';
      }
    });
  }

  destroy() {}
}
