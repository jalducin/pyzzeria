/**
 * router/index.js
 * Hash-based SPA router con guards de autenticación y RBAC.
 *
 * Rutas: #/login, #/pos, #/products, #/sales, #/refunds, #/reports, #/branches, #/audit
 */
import AuthStore from '../store/auth.js';

const routes = [
  { hash: '/login',    page: () => import('../pages/LoginPage.js'),       public: true },
  { hash: '/pos',      page: () => import('../pages/POSPage.js'),         minRole: 'cashier' },
  { hash: '/products', page: () => import('../pages/ProductsPage.js'),    minRole: 'admin' },
  { hash: '/sales',    page: () => import('../pages/SalesHistoryPage.js'),minRole: 'supervisor' },
  { hash: '/refunds',  page: () => import('../pages/RefundsPage.js'),     minRole: 'supervisor' },
  { hash: '/reports',  page: () => import('../pages/ReportsPage.js'),     minRole: 'supervisor' },
  { hash: '/branches', page: () => import('../pages/BranchesPage.js'),    minRole: 'admin' },
  { hash: '/audit',    page: () => import('../pages/AuditPage.js'),       minRole: 'admin' },
];

/** Devuelve el hash actual sin el '#' inicial. */
function getHash() {
  return window.location.hash.slice(1) || '/pos';
}

/** Navega programáticamente. */
export function navigate(hash) {
  window.location.hash = hash;
}

/** Redirige al home según el rol. */
export function redirectToHome() {
  const role = AuthStore.role;
  if (role === 'admin' || role === 'supervisor') navigate('/reports');
  else navigate('/pos');
}

let _contentEl = null;
let _currentPage = null;

/**
 * Monta el router en el elemento destino.
 * @param {HTMLElement} contentEl - Donde se renderiza cada página.
 */
export function initRouter(contentEl) {
  _contentEl = contentEl;
  window.addEventListener('hashchange', _handleRoute);
  _handleRoute();
}

async function _handleRoute() {
  const hash = getHash();
  const route = routes.find(r => hash.startsWith(r.hash)) ?? null;

  // Ruta no encontrada → redirigir
  if (!route) {
    navigate(AuthStore.isAuthenticated ? '/pos' : '/login');
    return;
  }

  // Guard: no autenticado
  if (!route.public && !AuthStore.isAuthenticated) {
    navigate('/login');
    return;
  }

  // Guard: autenticado intentando ir al login
  if (route.public && AuthStore.isAuthenticated) {
    redirectToHome();
    return;
  }

  // Guard: RBAC
  if (route.minRole && !AuthStore.can(route.minRole)) {
    redirectToHome();
    return;
  }

  // Limpiar la página anterior
  if (_currentPage?.destroy) _currentPage.destroy();

  // Mostrar spinner mientras carga
  _contentEl.innerHTML = '<div class="empty-state"><div class="spinner spinner-lg"></div></div>';

  try {
    const module = await route.page();
    const PageClass = module.default;
    _currentPage = new PageClass(_contentEl);
    await _currentPage.render();
  } catch (err) {
    console.error('[Router] Error loading page:', err);
    _contentEl.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <h3>Error al cargar la página</h3>
        <p>${err.message}</p>
      </div>`;
  }
}
