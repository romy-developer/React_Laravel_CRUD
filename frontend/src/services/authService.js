import api from './api.js';

export async function getCurrentUser() {
  const response = await api.get('/auth/me');
  return response.data.data;
}

export async function signOut() {
  return api.post('/auth/logout');
}
