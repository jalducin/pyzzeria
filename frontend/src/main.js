/**
 * main.js — Bootstrap de la SPA POS Retail
 *
 * 1. Inicializa AuthStore (lee token de localStorage)
 * 2. Si el usuario está autenticado → monta el shell (Navbar + Sidebar + Main)
 * 3. Si no → renderiza solo LoginPage
 * 4. Escucha cambios de hash para actualizar el shell según auth state
 */
import AuthStore from './store/auth.js';
import { initRouter, navigate } from './router/index.js';
import Navbar from './components/Navbar.js';
import Sidebar from './components/Sidebar.js';

// Inicializar store desde localStorage
AuthStore.init();

const appEl = document.getElementById('app');

/**
 * Monta el shell autenticado:
 *   [Navbar (top)]
 *   [Sidebar | Main content]
 */
function mountShell() {
  appEl.innerHTML = `
    <div class="app-shell">
      <div id="navbar-slot"></div>
      <div id="sidebar-slot"></div>
      <main class="main-content" id="main-content"></main>
    </div>`;

  const navbarSlot = document.getElementById('navbar-slot');
  const sidebarSlot = document.getElementById('sidebar-slot');
  const mainContent = document.getElementById('main-content');

  const navbar = new Navbar(navbarSlot);
  navbar.render();

  const sidebar = new Sidebar(sidebarSlot);
  sidebar.render();

  // Iniciar router en el contenedor principal
  initRouter(mainContent);
}

/**
 * Monta solo el login (sin shell).
 */
function mountLogin() {
  appEl.innerHTML = '<div id="login-root"></div>';
  initRouter(document.getElementById('login-root'));
}

// Decisión inicial de montaje
if (AuthStore.isAuthenticated) {
  mountShell();
} else {
  mountLogin();
}

// Escuchar eventos de login/logout para remontaje dinámico
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.slice(1);
  const wasAuth = appEl.querySelector('.app-shell') !== null;
  const isAuth = AuthStore.isAuthenticated;

  if (isAuth && !wasAuth) {
    // Usuario acaba de loguearse
    mountShell();
  } else if (!isAuth && wasAuth) {
    // Usuario acaba de desloguearse
    mountLogin();
    navigate('/login');
  }
});
