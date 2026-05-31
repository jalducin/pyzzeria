/**
 * components/Navbar.js
 * Barra superior fija con logo, usuario y logout.
 */
import AuthStore from '../store/auth.js';
import { logout } from '../api/auth.js';
import { navigate } from '../router/index.js';
import toast from './Toast.js';

export default class Navbar {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.container = container;
  }

  render() {
    const initials = AuthStore.roleLabel?.[0]?.toUpperCase() ?? 'U';

    this.container.innerHTML = `
      <nav class="navbar" id="main-navbar">
        <div class="navbar-brand">
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill="url(#navGrad)"/>
            <path d="M14 16h20M14 24h14M14 32h8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="35" cy="32" r="5" fill="white" fill-opacity="0.9"/>
            <defs>
              <linearGradient id="navGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stop-color="#6c63ff"/><stop offset="1" stop-color="#4f46e5"/>
              </linearGradient>
            </defs>
          </svg>
          <span>POS Retail</span>
        </div>

        <div class="navbar-actions">
          <div class="navbar-user">
            <div class="navbar-user-info">
              <span class="navbar-user-name">${AuthStore.roleLabel}</span>
              <span class="navbar-user-role">${AuthStore.role ?? ''}</span>
            </div>
            <div class="navbar-avatar" title="${AuthStore.roleLabel}">${initials}</div>
          </div>
          <button class="btn btn-ghost btn-sm" id="logout-btn" title="Cerrar sesión">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Salir
          </button>
        </div>
      </nav>`;

    this.container.querySelector('#logout-btn').addEventListener('click', async () => {
      await logout();
      AuthStore.logout();
      toast.info('Sesión cerrada');
      navigate('/login');
    });
  }
}
