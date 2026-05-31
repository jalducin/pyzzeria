/** api/reports.js — Endpoints de reportes */
import { get } from './client.js';

export const getDailyReport = (date) => get('/reports/daily', date ? { date } : {});
export const getTopProducts = (from, to) => get('/reports/top-products', { from, to });
export const getCashierReport = (cashierId, date) => get(`/reports/cashier/${cashierId}`, date ? { date } : {});
