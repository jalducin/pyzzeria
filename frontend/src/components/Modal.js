/**
 * components/Modal.js
 * Modal genérico reutilizable.
 */

export default class Modal {
  /** @param {{ title, content, size?, onClose?, footer? }} opts */
  constructor(opts = {}) {
    this.opts = opts;
    this._el = null;
    this._overlay = document.getElementById('modal-overlay');
  }

  open() {
    const { title, content, size = '', onClose, footer = '' } = this.opts;

    this._overlay.innerHTML = `
      <div class="modal ${size}" id="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h3 id="modal-title">${title}</h3>
          <button class="btn btn-ghost btn-icon" id="modal-close-btn" aria-label="Cerrar">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">${content}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>`;

    this._overlay.classList.remove('hidden');
    this._el = this._overlay.querySelector('#modal-box');

    this._overlay.querySelector('#modal-close-btn').addEventListener('click', () => this.close());
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) this.close();
    });

    // Foco al modal
    this._el.focus?.();
    return this;
  }

  close() {
    this._overlay.classList.add('hidden');
    this._overlay.innerHTML = '';
    this.opts.onClose?.();
  }

  /** Actualiza el contenido del body sin recrear el modal */
  setContent(html) {
    const body = this._overlay.querySelector('.modal-body');
    if (body) body.innerHTML = html;
  }
}
