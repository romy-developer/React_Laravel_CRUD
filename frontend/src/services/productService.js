import api from './api.js';

function toFormData(product) {
  const data = new FormData();
  Object.entries(product).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((item) => data.append(`${key}[]`, item));
        return;
      }
      data.append(key, value === true ? '1' : value === false ? '0' : value);
    }
  });
  return data;
}

export async function getProducts() {
  const response = await api.get('/products');
  return response.data.data;
}

export async function getInventoryMovements(productId, page = 1) {
  const response = await api.get(`/admin/products/${productId}/inventory-movements`, { params: { page } });
  return response.data;
}

export async function getStoreProducts(filters) {
  const response = await api.get('/store/products', { params: filters });
  return response.data;
}

export async function getFeaturedProducts() {
  const response = await api.get('/store/featured');
  return response.data.data;
}

export async function getStorePromotions() {
  const response = await api.get('/store/promotions');
  return response.data.data;
}

export async function getStoreProduct(id) {
  const response = await api.get(`/store/products/${encodeURIComponent(id)}`);
  return response.data.data;
}

export async function getProductReviews(id, page = 1) {
  const response = await api.get(`/store/products/${encodeURIComponent(id)}/reviews`, { params: { page } });
  return response.data;
}

export async function saveProductReview(id, values) {
  const response = await api.post(`/account/products/${encodeURIComponent(id)}/review`, values);
  return response.data.data;
}

export async function getMyProductReview(id) {
  const response = await api.get(`/account/products/${encodeURIComponent(id)}/review`);
  return response.data.data;
}

export function storeProductPath(product) {
  const slug = String(product.name || 'product').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';
  return `/shop/products/${slug}-${product.id}`;
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

export async function placeOrder(values, items, idempotencyKey, accessToken) {
  const response = await api.post('/checkout', {
    ...values,
    payment_method: 'cash_on_delivery',
    accept_policy: values.accept_policy ? 1 : 0,
    items: items.map((item) => ({ product_id: item.id, quantity: item.quantity })),
  }, {
    headers: {
      'Idempotency-Key': idempotencyKey,
      'X-Order-Access-Token': accessToken,
    },
  });
  return response.data.data;
}

export async function getOrder(orderNumber, accessToken) {
  const response = await api.get(`/orders/${encodeURIComponent(orderNumber)}`, {
    headers: { 'X-Order-Access-Token': accessToken },
  });
  return response.data.data;
}

export async function cancelPrivateOrder(orderNumber, accessToken) {
  const response = await api.post(`/orders/${encodeURIComponent(orderNumber)}/cancel`, {}, {
    headers: { 'X-Order-Access-Token': accessToken },
  });
  return response.data.data;
}

export async function getAdminOrders(filters) {
  const response = await api.get('/admin/orders', { params: filters });
  return response.data;
}

export async function getAdminFulfillmentStaff() {
  const response = await api.get('/admin/fulfillment-staff');
  return response.data.data;
}

export async function getAdminStaff(filters) {
  const response = await api.get('/admin/staff', { params: filters });
  return response.data;
}

export async function updateAdminStaffRole(userId, role) {
  const response = await api.patch(`/admin/staff/${userId}`, { role });
  return response.data.data;
}

export async function getAdminAuditLogs(filters) {
  const response = await api.get('/admin/audit-logs', { params: filters });
  return response.data;
}

export async function assignAdminOrder(orderNumber, userId) {
  const response = await api.patch(`/admin/orders/${encodeURIComponent(orderNumber)}/assignment`, { user_id: userId || null });
  return response.data.data;
}

export async function getAdminCustomers(filters) {
  const response = await api.get('/admin/customers', { params: filters });
  return response.data;
}

export async function getAdminCustomer(id, page = 1) {
  const response = await api.get(`/admin/customers/${id}`, { params: { page } });
  return response.data.data;
}

export async function updateAdminOrder(orderNumber, status, shipment = {}) {
  const response = await api.patch(`/admin/orders/${encodeURIComponent(orderNumber)}`, { status, ...shipment });
  return response.data.data;
}

export async function recordAdminRefund(orderNumber, values, idempotencyKey) {
  const response = await api.post(`/admin/orders/${encodeURIComponent(orderNumber)}/refund`, {
    ...values,
    idempotency_key: idempotencyKey,
  });
  return response.data.data;
}

export async function getCustomerAccount(page = 1) {
  const [profile, addresses, orders] = await Promise.all([
    api.get('/account/profile'),
    api.get('/account/addresses'),
    api.get('/account/orders', { params: { page } }),
  ]);
  return { profile: profile.data.data, addresses: addresses.data.data, orders: orders.data };
}

export async function getCustomerCheckoutDetails() {
  const [profile, addresses] = await Promise.all([
    api.get('/account/profile'),
    api.get('/account/addresses'),
  ]);
  return { profile: profile.data.data, addresses: addresses.data.data };
}

export async function updateCustomerProfile(values) {
  const response = await api.put('/account/profile', values);
  return response.data.data;
}

export async function saveCustomerAddress(values, id = null) {
  const response = id
    ? await api.put(`/account/addresses/${id}`, values)
    : await api.post('/account/addresses', values);
  return response.data.data;
}

export async function deleteCustomerAddress(id) {
  return api.delete(`/account/addresses/${id}`);
}

export async function cancelCustomerOrder(orderNumber) {
  const response = await api.post(`/account/orders/${encodeURIComponent(orderNumber)}/cancel`);
  return response.data.data;
}

export async function getAdminCoupons() {
  const response = await api.get('/admin/coupons');
  return response.data.data;
}

export async function saveAdminCoupon(values, id = null) {
  const response = id
    ? await api.put(`/admin/coupons/${id}`, values)
    : await api.post('/admin/coupons', values);
  return response.data.data;
}

export async function disableAdminCoupon(id) {
  const response = await api.delete(`/admin/coupons/${id}`);
  return response.data.data;
}

export async function previewCoupon(code, items) {
  const response = await api.post('/store/coupons/validate', {
    code,
    items: items.map((item) => ({ product_id: item.id, quantity: item.quantity })),
  });
  return response.data.data;
}

export async function getCustomerCart() {
  const response = await api.get('/account/cart');
  return response.data.data;
}

export async function mergeCustomerCart(items) {
  const payloadKey = 'fieldnotes-cart-merge-payload';
  let merged;
  try { merged = JSON.parse(window.localStorage.getItem(payloadKey) || 'null'); } catch { merged = null; }
  if (!Array.isArray(merged)) {
    const remote = await getCustomerCart();
    const lines = new Map(remote.map((item) => [Number(item.id), { ...item }]));
    items.forEach((item) => {
      const id = Number(item.id);
      const current = lines.get(id);
      lines.set(id, { ...(current || item), id, quantity: Number(current?.quantity || 0) + Number(item.quantity || 0) });
    });
    merged = [...lines.values()];
    window.localStorage.setItem(payloadKey, JSON.stringify(merged.map(({ id, quantity }) => ({ id, quantity }))));
  }
  const canonical = await syncCustomerCart(merged);
  window.localStorage.removeItem(payloadKey);
  return canonical;
}

export async function syncCustomerCart(items) {
  const response = await api.put('/account/cart', {
    items: items.map((item) => ({ id: item.id, quantity: item.quantity })),
  });
  return response.data.data;
}
