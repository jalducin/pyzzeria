/**
 * components/DataTable.js
 * Tabla de datos reutilizable con paginación client-side.
 */
export default class DataTable {
  /**
   * @param {HTMLElement} container
   * @param {{ columns, data, pageSize?, onRowClick?, emptyMsg? }} opts
   */
  constructor(container, opts) {
    this.container = container;
    this.columns = opts.columns;     // [{ key, label, render?, width? }]
    this.data = opts.data ?? [];
    this.pageSize = opts.pageSize ?? 20;
    this.onRowClick = opts.onRowClick ?? null;
    this.emptyMsg = opts.emptyMsg ?? 'Sin registros';
    this.currentPage = 1;
  }

  get totalPages() {
    return Math.max(1, Math.ceil(this.data.length / this.pageSize));
  }

  get pageData() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.data.slice(start, start + this.pageSize);
  }

  render() {
    this.container.innerHTML = '';

    if (!this.data.length) {
      this.container.innerHTML = `
        <div class="empty-state">
          <svg class="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <h3>${this.emptyMsg}</h3>
        </div>`;
      return;
    }

    const thead = this.columns.map(c =>
      `<th style="${c.width ? `width:${c.width}` : ''}">${c.label}</th>`
    ).join('');

    const tbody = this.pageData.map((row, i) => {
      const cells = this.columns.map(c => {
        const val = c.render ? c.render(row) : (row[c.key] ?? '—');
        return `<td>${val}</td>`;
      }).join('');
      return `<tr class="${this.onRowClick ? 'clickable' : ''}" data-idx="${i}">${cells}</tr>`;
    }).join('');

    const paginationHtml = this.totalPages > 1 ? this._renderPagination() : '';

    this.container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
      ${paginationHtml}`;

    // Event listeners
    if (this.onRowClick) {
      this.container.querySelectorAll('tbody tr').forEach(tr => {
        tr.addEventListener('click', () => {
          const idx = parseInt(tr.dataset.idx);
          this.onRowClick(this.pageData[idx]);
        });
      });
    }

    // Pagination
    this.container.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.page;
        if (p === 'prev') this.currentPage = Math.max(1, this.currentPage - 1);
        else if (p === 'next') this.currentPage = Math.min(this.totalPages, this.currentPage + 1);
        else this.currentPage = parseInt(p);
        this.render();
      });
    });
  }

  _renderPagination() {
    const { currentPage: cp, totalPages: tp } = this;
    let pages = '';
    for (let i = 1; i <= tp; i++) {
      if (i === 1 || i === tp || (i >= cp - 1 && i <= cp + 1)) {
        pages += `<button class="pagination-btn ${i === cp ? 'active' : ''}" data-page="${i}">${i}</button>`;
      } else if (i === cp - 2 || i === cp + 2) {
        pages += `<span style="color:var(--color-text-faint);padding:0 4px">…</span>`;
      }
    }
    return `<div class="pagination">
      <button class="pagination-btn" data-page="prev" ${cp === 1 ? 'disabled' : ''}>&#8592;</button>
      ${pages}
      <button class="pagination-btn" data-page="next" ${cp === tp ? 'disabled' : ''}>&#8594;</button>
    </div>`;
  }

  /** Actualiza los datos y re-renderiza. */
  setData(data) {
    this.data = data;
    this.currentPage = 1;
    this.render();
  }
}
