/**
 * pages/AuditPage.js — Log de auditoría (Admin)
 */
import { listAuditLogs } from '../api/audit.js';
import DataTable from '../components/DataTable.js';
import toast from '../components/Toast.js';
import { formatDate, shortId, roleBadge } from '../utils.js';

const ACTION_BADGE = {
  create: '<span class="badge badge-success">create</span>',
  update: '<span class="badge badge-primary">update</span>',
  delete: '<span class="badge badge-error">delete</span>',
  refund: '<span class="badge badge-warning">refund</span>',
};

export default class AuditPage {
  constructor(container) {
    this.container = container;
    this.logs = [];
    this._filter = { entity_type: '', action: '' };
  }

  async render() {
    this.container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header">
          <div>
            <h1>Log de Auditoría</h1>
            <p class="text-muted text-sm mt-2">Registro de todas las operaciones sensibles del sistema</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="refresh-audit-btn">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Actualizar
          </button>
        </div>

        <div class="filters-bar">
          <select class="form-select" id="audit-entity" style="width:180px">
            <option value="">Todas las entidades</option>
            <option value="Sale">Sale</option>
            <option value="Product">Product</option>
            <option value="Refund">Refund</option>
            <option value="User">User</option>
            <option value="Branch">Branch</option>
          </select>
          <select class="form-select" id="audit-action" style="width:160px">
            <option value="">Todas las acciones</option>
            <option value="create">create</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
            <option value="refund">refund</option>
          </select>
        </div>

        <div id="audit-table-container"></div>
      </div>`;

    await this._loadLogs();
    this._bindEvents();
  }

  async _loadLogs() {
    const params = {};
    const entity = this.container.querySelector('#audit-entity')?.value;
    const action = this.container.querySelector('#audit-action')?.value;
    if (entity) params.entity_type = entity;
    if (action) params.action = action;

    try {
      this.logs = await listAuditLogs(params);
      this._renderTable();
    } catch (err) {
      this.container.querySelector('#audit-table-container').innerHTML = `
        <div class="card" style="border-color:var(--color-warning);background:var(--color-warning-soft)">
          <p style="color:var(--color-warning)">⚠️ Endpoint pendiente (Sprint 4): ${err.message}</p>
          <p class="text-sm text-muted mt-2">GET /audit-logs se implementa en T4-08 del SDD.</p>
        </div>`;
    }
  }

  _renderTable() {
    const container = this.container.querySelector('#audit-table-container');
    new DataTable(container, {
      columns: [
        { key: 'created_at', label: 'Fecha', render: r => formatDate(r.created_at) },
        { key: 'action', label: 'Acción', render: r => ACTION_BADGE[r.action] ?? r.action },
        { key: 'entity_type', label: 'Entidad', render: r => `<code style="font-size:var(--font-size-xs);color:var(--color-primary)">${r.entity_type}</code>` },
        { key: 'entity_id', label: 'ID', render: r => `<span class="font-mono text-xs">${shortId(r.entity_id)}</span>` },
        { key: 'actor_id', label: 'Actor', render: r => `<span class="font-mono text-xs text-muted">${shortId(r.actor_id)}</span>` },
        { key: 'trace_id', label: 'Trace ID', render: r => r.trace_id ? `<span class="font-mono text-xs text-muted">${r.trace_id.slice(0, 12)}…</span>` : '—' },
      ],
      data: this.logs,
      pageSize: 30,
      emptyMsg: 'No hay registros de auditoría'
    }).render();
  }

  _bindEvents() {
    this.container.querySelector('#refresh-audit-btn').addEventListener('click', () => this._loadLogs());
    this.container.querySelector('#audit-entity').addEventListener('change', () => this._loadLogs());
    this.container.querySelector('#audit-action').addEventListener('change', () => this._loadLogs());
  }

  destroy() {}
}
