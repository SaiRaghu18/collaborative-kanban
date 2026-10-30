import axios from 'axios';
import type { ApiResponse } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Axios instance configured for the backend API
// ─────────────────────────────────────────────────────────────────────────────

// Normalize API base URL: prevents accidental duplicate `/api/api` if VITE_API_URL already contains `/api`
const getApiBase = (): string => {
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
  if (!envUrl) return '/api';
  const clean = envUrl.trim().replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
};

const apiClient = axios.create({
  baseURL: getApiBase(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ─── Request interceptor: attach JWT token ────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kanban_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor: handle 401 globally ───────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear storage and redirect to login
      localStorage.removeItem('kanban_token');
      localStorage.removeItem('kanban_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// ─── Typed helper to extract data from ApiResponse ───────────────────────────
export function extractData<T>(response: { data: ApiResponse<T> }): T {
  if (!response.data.success || response.data.data === undefined) {
    throw new Error(response.data.error || 'API error');
  }
  return response.data.data;
}
