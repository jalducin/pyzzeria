/** api/branches.js — Endpoints de sucursales */
import { get, post, put } from './client.js';

export const listBranches = () => get('/branches');
export const createBranch = (data) => post('/branches', data);
export const updateBranch = (id, data) => put(`/branches/${id}`, data);
