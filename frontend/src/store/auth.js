/**
 * store/auth.js
 * Estado global de autenticación: token JWT, usuario decodificado, rol.
 */

const TOKEN_KEY = 'pos_token';

/** Decodifica el payload de un JWT (sin verificar firma en cliente). */
function decodeJWT(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

const AuthStore = {
  _token: null,
  _user: null,

  /** Inicializa desde localStorage (llamado al arrancar la app). */
  init() {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      const payload = decodeJWT(stored);
      // Verificar que no haya expirado
      if (payload && payload.exp * 1000 > Date.now()) {
        this._token = stored;
        this._user = payload;
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  },

  /** Persiste el token tras login exitoso. */
  setToken(token) {
    this._token = token;
    this._user = decodeJWT(token);
    localStorage.setItem(TOKEN_KEY, token);
  },

  /** Limpia la sesión. */
  logout() {
    this._token = null;
    this._user = null;
    localStorage.removeItem(TOKEN_KEY);
  },

  get token() { return this._token; },

  get isAuthenticated() { return !!this._token; },

  /** role: 'cashier' | 'supervisor' | 'admin' */
  get role() { return this._user?.role ?? null; },

  get userId() { return this._user?.sub ?? null; },

  get branchId() { return this._user?.branch_id ?? null; },

  /** Nombre descriptivo del rol en español */
  get roleLabel() {
    const map = { cashier: 'Cajero', supervisor: 'Supervisor', admin: 'Administrador' };
    return map[this.role] ?? this.role;
  },

  /** Comprueba si el rol actual tiene acceso a un nivel requerido */
  can(minRole) {
    const levels = { cashier: 1, supervisor: 2, admin: 3 };
    return (levels[this.role] ?? 0) >= (levels[minRole] ?? 0);
  }
};

export default AuthStore;
