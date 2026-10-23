import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, ''),
  headers: {
    Accept: 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = config.url?.startsWith('/account')
    ? window.localStorage.getItem('fieldnotes-customer-token')
    : config.url === '/checkout'
      ? window.localStorage.getItem('fieldnotes-customer-token') || window.localStorage.getItem('fieldnotes-session-token')
      : window.localStorage.getItem('fieldnotes-session-token') || window.localStorage.getItem('fieldnotes-customer-token');
  if (token && !config.headers.Authorization && !config.headers.authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
