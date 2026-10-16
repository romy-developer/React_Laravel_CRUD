import api from './api.js';

function toFormData(product) {
  const data = new FormData();
  Object.entries(product).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== false) {
      data.append(key, value === true ? '1' : value);
    }
  });
  return data;
}

export async function getProducts() {
  const response = await api.get('/products');
  return response.data.data;
}

export async function getProduct(id) {
  const response = await api.get(`/products/${id}`);
  return response.data.data;
}

export async function createProduct(product) {
  const response = await api.post('/products', toFormData(product));
  return response.data.data;
}

export async function updateProduct(id, product) {
  const data = toFormData(product);
  data.append('_method', 'PUT');
  const response = await api.post(`/products/${id}`, data);
  return response.data.data;
}

export async function deleteProduct(id) {
  const response = await api.delete(`/products/${id}`);
  return response.data;
}
