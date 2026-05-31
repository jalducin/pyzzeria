/** api/sales.js — Endpoints de ventas y devoluciones */
import { get, post } from './client.js';

/**
 * Crea una venta con idempotencia.
 * @param {object} payload - { items, payment_method, cash_received? }
 * @param {string} idempotencyKey
 */
export const createSale = (payload, idempotencyKey) =>
  post('/sales', payload, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {});

export const getSale = (id) => get(`/sales/${id}`);

export const listSales = (params = {}) => get('/sales', params);

export const refundSale = (id, payload) => post(`/sales/${id}/refund`, payload);
