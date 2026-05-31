/** api/auth.js — Endpoints de autenticación */
import { post } from './client.js';

export async function login(email, password) {
  return post('/auth/login', { email, password });
}

export async function logout() {
  try { await post('/auth/logout', {}); } catch { /* ignorar */ }
}
