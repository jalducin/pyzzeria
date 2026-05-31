/**
 * pages/LoginPage.js
 */
import { login } from '../api/auth.js';
import AuthStore from '../store/auth.js';
import { redirectToHome } from '../router/index.js';

export default class LoginPage {
  constructor(container) {
    this.container = container;
    this._loading = false;
  }

  render() {
    this.container.innerHTML = `
      <div class="login-page animate-fade-in">
        <div class="login-hero">
          <div class="login-hero-content">
            <div class="login-hero-logo">
              <svg class="login-hero-logo-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="14" fill="url(#lg1)"/>
                <path d="M14 16h20M14 24h14M14 32h8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                <circle cx="35" cy="32" r="5" fill="white" fill-opacity="0.9"/>
                <defs>
                  <linearGradient id="lg1" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#6c63ff"/><stop offset="1" stop-color="#4f46e5"/>
                  </linearGradient>
                </defs>
              </svg>
              <span class="login-hero-logo-text">POS Retail</span>
            </div>
            <h1>Sistema de Punto de Venta</h1>
            <p>Gestiona ventas, inventario y reportes desde una sola plataforma diseñada para tiendas retail.</p>
            <div class="login-hero-features">
              <div class="login-hero-feature">
                <div class="login-hero-feature-dot"></div>
                Multi-cajero y multi-sucursal
              </div>
              <div class="login-hero-feature">
                <div class="login-hero-feature-dot"></div>
                Efectivo, tarjeta, transferencia y QR
              </div>
              <div class="login-hero-feature">
                <div class="login-hero-feature-dot"></div>
                Reportes de ventas en tiempo real
              </div>
              <div class="login-hero-feature">
                <div class="login-hero-feature-dot"></div>
                Devoluciones con nota de crédito
              </div>
            </div>
          </div>
        </div>

        <div class="login-form-panel">
          <div class="login-form-container">
            <div class="login-form-header">
              <h2>Iniciar sesión</h2>
              <p>Ingresa tus credenciales para acceder al sistema</p>
            </div>

            <div id="login-error" class="login-error-banner hidden">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              <span id="login-error-text"></span>
            </div>

            <form class="login-form" id="login-form" novalidate>
              <div class="form-group">
                <label class="form-label" for="email">Correo electrónico</label>
                <input
                  class="form-input"
                  type="email"
                  id="email"
                  name="email"
                  placeholder="cajero@tienda.com"
                  autocomplete="email"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="password">Contraseña</label>
                <input
                  class="form-input"
                  type="password"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  required
                />
              </div>

              <button class="btn btn-primary btn-lg w-full" type="submit" id="login-btn">
                <span id="login-btn-text">Ingresar al sistema</span>
                <div class="spinner spinner-sm hidden" id="login-spinner"></div>
              </button>
            </form>
          </div>
        </div>
      </div>`;

    this.container.querySelector('#login-form').addEventListener('submit', (e) => this._handleSubmit(e));
    // Enfocar el primer campo
    setTimeout(() => this.container.querySelector('#email')?.focus(), 100);
  }

  async _handleSubmit(e) {
    e.preventDefault();
    if (this._loading) return;

    const email = this.container.querySelector('#email').value.trim();
    const password = this.container.querySelector('#password').value;
    const errorBanner = this.container.querySelector('#login-error');
    const errorText = this.container.querySelector('#login-error-text');

    errorBanner.classList.add('hidden');

    if (!email || !password) {
      errorBanner.classList.remove('hidden');
      errorText.textContent = 'Por favor ingresa tu correo y contraseña.';
      return;
    }

    this._setLoading(true);
    try {
      const data = await login(email, password);
      AuthStore.setToken(data.access_token);
      redirectToHome();
    } catch (err) {
      errorBanner.classList.remove('hidden');
      if (err.code === 'AUTH_REQUIRED') {
        errorText.textContent = 'Credenciales incorrectas. Verifica tu correo y contraseña.';
      } else {
        errorText.textContent = err.message ?? 'Error al iniciar sesión. Intenta nuevamente.';
      }
      this.container.querySelector('#password').value = '';
      this.container.querySelector('#password').focus();
    } finally {
      this._setLoading(false);
    }
  }

  _setLoading(val) {
    this._loading = val;
    const btn = this.container.querySelector('#login-btn');
    const text = this.container.querySelector('#login-btn-text');
    const spinner = this.container.querySelector('#login-spinner');
    btn.disabled = val;
    text.textContent = val ? 'Ingresando…' : 'Ingresar al sistema';
    spinner.classList.toggle('hidden', !val);
  }

  destroy() {}
}
