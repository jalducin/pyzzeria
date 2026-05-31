/**
 * pages/BranchesPage.js — Gestión de sucursales (Admin)
 */
import { listBranches, createBranch, updateBranch } from '../api/branches.js';
import DataTable from '../components/DataTable.js';
import Modal from '../components/Modal.js';
import toast from '../components/Toast.js';
import { formatDate } from '../utils.js';

export default class BranchesPage {
  constructor(container) {
    this.container = container;
    this.branches = [];
  }

  async render() {
    this.container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div>
            <h1>Sucursales</h1>
            <p class="text-muted text-sm mt-2">Gestiona las sucursales de la tienda</p>
          </div>
          <button class="btn btn-primary" id="new-branch-btn">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Nueva Sucursal
          </button>
        </div>
        <div id="branches-table-container"></div>
      </div>`;

    await this._loadBranches();
    this.container.querySelector('#new-branch-btn').addEventListener('click', () => this._openModal(null));
  }

  async _loadBranches() {
    try {
      this.branches = await listBranches();
      this._renderTable();
    } catch (err) {
      this.container.querySelector('#branches-table-container').innerHTML = `
        <div class="card" style="border-color:var(--color-warning);background:var(--color-warning-soft)">
          <p style="color:var(--color-warning)">⚠️ Endpoint pendiente (Sprint 4): ${err.message}</p>
          <p class="text-sm text-muted mt-2">GET /branches se implementa en T1-03 del SDD.</p>
        </div>`;
    }
  }

  _renderTable() {
    const container = this.container.querySelector('#branches-table-container');
    new DataTable(container, {
      columns: [
        { key: 'name', label: 'Nombre' },
        { key: 'address', label: 'Dirección', render: r => r.address ?? '—' },
        { key: 'timezone', label: 'Zona Horaria', render: r => r.timezone ?? 'America/Mexico_City' },
        { key: 'is_active', label: 'Estado', render: r => r.is_active
          ? '<span class="badge badge-success">Activa</span>'
          : '<span class="badge badge-error">Inactiva</span>' },
        { key: 'created_at', label: 'Creada', render: r => formatDate(r.created_at) },
        { key: 'actions', label: '', render: r => `
          <button class="btn btn-secondary btn-sm edit-branch-btn" data-id="${r.id}">Editar</button>` }
      ],
      data: this.branches,
      emptyMsg: 'No hay sucursales registradas'
    }).render();

    this.container.querySelectorAll('.edit-branch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const branch = this.branches.find(b => b.id === btn.dataset.id);
        if (branch) this._openModal(branch);
      });
    });
  }

  _openModal(branch) {
    const isNew = !branch;
    const modal = new Modal({
      title: isNew ? 'Nueva Sucursal' : 'Editar Sucursal',
      content: `
        <form id="branch-form">
          <div class="form-group mb-4">
            <label class="form-label" for="b-name">Nombre *</label>
            <input class="form-input" id="b-name" value="${branch?.name ?? ''}" required />
          </div>
          <div class="form-group mb-4">
            <label class="form-label" for="b-address">Dirección</label>
            <input class="form-input" id="b-address" value="${branch?.address ?? ''}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="b-timezone">Zona Horaria</label>
            <select class="form-select" id="b-timezone">
              <option value="America/Mexico_City" ${(branch?.timezone ?? 'America/Mexico_City') === 'America/Mexico_City' ? 'selected' : ''}>
                America/Mexico_City (Centro)
              </option>
              <option value="America/Monterrey" ${branch?.timezone === 'America/Monterrey' ? 'selected' : ''}>
                America/Monterrey (Norte)
              </option>
              <option value="America/Tijuana" ${branch?.timezone === 'America/Tijuana' ? 'selected' : ''}>
                America/Tijuana (Noroeste)
              </option>
            </select>
          </div>
          <div id="branch-error" class="form-error mt-4 hidden"></div>
        </form>`,
      footer: `
        <button class="btn btn-secondary" id="b-cancel">Cancelar</button>
        <button class="btn btn-primary" id="b-save">${isNew ? 'Crear' : 'Guardar'}</button>`
    });
    modal.open();

    document.getElementById('b-cancel')?.addEventListener('click', () => modal.close());
    document.getElementById('b-save')?.addEventListener('click', async () => {
      const errEl = document.getElementById('branch-error');
      const name = document.getElementById('b-name').value.trim();
      if (!name) { errEl.textContent = 'El nombre es obligatorio'; errEl.classList.remove('hidden'); return; }

      const data = {
        name,
        address: document.getElementById('b-address').value.trim() || null,
        timezone: document.getElementById('b-timezone').value
      };

      try {
        if (isNew) await createBranch(data);
        else await updateBranch(branch.id, data);
        toast.success(isNew ? 'Sucursal creada' : 'Sucursal actualizada');
        modal.close();
        await this._loadBranches();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    });
  }

  destroy() {}
}
