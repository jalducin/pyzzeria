/**
 * api/client.js
 * Fetch wrapper centralizado: adjunta JWT, maneja errores según el contrato
 * estándar del SDD (design.md §6), y lanza excepciones tipadas.
 */
import AuthStore from '../store/auth.js';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export class APIError extends Error {
  constructor(code, message, status, details = {}) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Realiza una petición autenticada a la API.
 */
async function request(path, opts = {}) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...(opts.headers ?? {})
  });

  if (AuthStore.token) {
    headers.set('Authorization', `Bearer ${AuthStore.token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers
  });

  // 204 No Content
  if (response.status === 204) return undefined;

  let data;
  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    data = await response.json();
  } else {
    data = { error: { code: 'INTERNAL_ERROR', message: await response.text() } };
  }

  if (!response.ok) {
    const err = data?.error ?? {};
    throw new APIError(
      err.code ?? 'INTERNAL_ERROR',
      err.message ?? `HTTP ${response.status}`,
      response.status,
      err.details ?? {}
    );
  }

  return data;
}

export async function get(path, params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''))
  ).toString();
  const url = qs ? `${path}?${qs}` : path;
  return request(url, { method: 'GET' });
}

export async function post(path, body, extraHeaders = {}) {
  return request(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: extraHeaders
  });
}

export async function put(path, body) {
  return request(path, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export async function del(path) {
  return request(path, { method: 'DELETE' });
}

export default { get, post, put, del };
