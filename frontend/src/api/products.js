/** api/products.js — Endpoints de productos */
import { get, post, put, del } from './client.js';

export const listProducts = (params = {}) => get('/products', params);
export const searchProducts = (q, limit = 30) => get('/products/search', { q, limit });
export const getProduct = (id) => get(`/products/${id}`);
export const createProduct = (data) => post('/products', data);
export const updateProduct = (id, data) => put(`/products/${id}`, data);
export const deleteProduct = (id) => del(`/products/${id}`);
