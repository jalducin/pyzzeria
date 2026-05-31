/** api/audit.js — Endpoints de auditoría */
import { get } from './client.js';

export const listAuditLogs = (params = {}) => get('/audit-logs', params);
