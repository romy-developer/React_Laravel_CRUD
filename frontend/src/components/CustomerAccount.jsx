import { useEffect, useState } from 'react';
import api from '../services/api.js';
import OrderTimeline from './OrderTimeline.jsx';
import {
  cancelCustomerOrder,
  deleteCustomerAddress,
  getCustomerAccount,
  getCustomerCart,
  mergeCustomerCart,
  saveCustomerAddress,
  storeProductPath,
  updateCustomerProfile,
} from '../services/productService.js';

const money = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount));
const emptyAddress = { label: 'Home', recipient_name: '', phone: '', address_line1: '', address_line2: '', city: '', region: '', postal_code: '', country: 'US', is_default: false };

function readLocalCart() {
  try { const items = JSON.parse(window.localStorage.getItem('fieldnotes-cart') || '[]'); return Array.isArray(items) ? items : []; }
  catch { return []; }
}

function CustomerOrders({ orders, orderPagination, orderPage, setOrderPage, refreshAccount, cancelOrder, onNavigate }) {
  async function turnPage(nextPage) {
    setOrderPage(nextPage);
    await refreshAccount(nextPage);
  }

  return <section className="account-card">
    <div className="account-section-heading"><div><p className="checkout-step">ORDER HISTORY</p><h2>Your orders</h2></div><span>{orderPagination?.total ?? 0} total</span></div>
    {orders.length ? <>
      <div className="account-order-list">{orders.map((order) => <article className="account-order" key={order.order_number}>
        <header><div><small>ORDER PLACED</small><strong>{new Date(order.created_at).toLocaleDateString()}</strong></div><div><small>ORDER NUMBER</small><strong>{order.order_number}</strong></div><div><small>TOTAL</small><strong>{money(order.grand_total)}</strong></div><span className={`order-status status-${order.status}`}>{order.status}</span></header>
        <OrderTimeline events={order.status_history} label={`Order status for ${order.order_number}`} />
        {order.tracking_number && <p className="account-tracking"><strong>Tracking:</strong> {order.shipping_carrier} · {order.tracking_number}{order.shipped_at ? ` · Shipped ${new Date(order.shipped_at).toLocaleDateString()}` : ''}</p>}
        {Number(order.refunded_total) > 0 && <p className="account-tracking"><strong>Refunded:</strong> {money(order.refunded_total)} of {money(order.grand_total)}</p>}
        <div className="account-order-body"><div className="account-order-lines">
          {order.coupon_code && <p className="account-tracking">Coupon {order.coupon_code}: -{money(order.discount_total)}</p>}
          {order.items.map((item, index) => <div key={`${item.product_name}-${index}`}><span><strong>{item.product_name}</strong><small>Qty {item.quantity} × {money(item.unit_price)}</small></span><b>{money(item.line_total)}</b></div>)}
        </div><aside><strong>Delivery</strong><p>{order.address.address_line1}<br />{order.address.city}, {order.address.region} {order.address.postal_code}</p><strong>Payment</strong><p>Cash on delivery · {order.payment_status}</p>{order.status === 'placed' && order.payment_status === 'pending' && <button type="button" className="account-cancel-order" onClick={() => cancelOrder(order)}>Cancel order</button>}</aside></div>
      </article>)}</div>
      {orderPagination?.last_page > 1 && <nav className="store-pagination" aria-label="Your order pages"><button className="button button-quiet" type="button" disabled={orderPage <= 1} onClick={() => void turnPage(orderPage - 1)}>Previous</button><span>Page {orderPage} of {orderPagination.last_page}</span><button className="button button-quiet" type="button" disabled={orderPage >= orderPagination.last_page} onClick={() => void turnPage(orderPage + 1)}>Next</button></nav>}
    </> : <div className="account-empty"><h3>No orders yet</h3><p>Your order history will appear here after checkout.</p><button type="button" className="confirmation-shop" onClick={() => onNavigate('/shop')}>Browse the shop</button></div>}
  </section>;
}

export default function CustomerAccount({ onNavigate }) {
  const [token, setToken] = useState(() => window.localStorage.getItem('fieldnotes-customer-token') || '');
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [addresses, setAddresses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderPagination, setOrderPagination] = useState(null);
  const [orderPage, setOrderPage] = useState(1);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() => new URLSearchParams(window.location.search).get('verified') === '1' ? 'Your email address has been verified.' : '');
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset_token') || '');
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).get('reset_token') ? 'reset' : 'login');
  const [tab, setTab] = useState('orders');
  const [authValues, setAuthValues] = useState(() => ({ name: '', email: new URLSearchParams(window.location.search).get('email') || '', password: '', password_confirmation: '' }));
  const [profileValues, setProfileValues] = useState({ name: '', email: '' });
  const [addressForm, setAddressForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  async function refreshAccount(page = orderPage) {
    const account = await getCustomerAccount(page);
    setProfile(account.profile);
    setProfileValues({ name: account.profile.name, email: account.profile.email });
    setAddresses(account.addresses);
    setOrders(account.orders.data || []);
    setOrderPagination(account.orders);
  }

  useEffect(() => {
    let active = true;
    if (!token) { setLoading(false); return () => { active = false; }; }
    setLoading(true);
    api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async ({ data }) => {
        if (!active) return;
        if (data.data.role !== 'customer') throw new Error('This sign-in is not a customer account.');
        await refreshAccount();
      })
      .catch((requestError) => {
        if (!active) return;
        window.localStorage.removeItem('fieldnotes-customer-token');
        setToken('');
        if (requestError.response?.status === 401) {
          window.localStorage.removeItem('fieldnotes-cart');
          window.localStorage.removeItem('fieldnotes-cart-owner-id');
          window.localStorage.removeItem('fieldnotes-cart-merge-pending');
          window.localStorage.removeItem('fieldnotes-cart-merge-payload');
        }
        if (requestError.message !== 'This sign-in is not a customer account.') setError('Your sign-in expired. Please sign in again.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function submitAuth(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (mode === 'forgot') {
        const response = await api.post('/auth/password/forgot', { email: authValues.email });
        setNotice(response.data.message);
        return;
      }
      if (mode === 'reset') {
        const response = await api.post('/auth/password/reset', { ...authValues, token: resetToken });
        setNotice(response.data.message);
        setMode('login');
        setResetToken('');
        window.localStorage.removeItem('fieldnotes-customer-token');
        setToken('');
        window.history.replaceState({}, '', '/account');
        setAuthValues((current) => ({ ...current, password: '', password_confirmation: '' }));
        return;
      }
      const response = mode === 'register'
        ? await api.post('/auth/register', authValues)
        : await api.post('/auth/login', { email: authValues.email, password: authValues.password });
      if (response.data.data.role !== 'customer') {
        await api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${response.data.token}` } }).catch(() => {});
        throw new Error('Use the administrator sign-in page for store management.');
      }
      window.localStorage.setItem('fieldnotes-customer-token', response.data.token);
      setToken(response.data.token);
      setError('');
      try {
        const customerId = String(response.data.data.id);
        const cachedOwner = window.localStorage.getItem('fieldnotes-cart-owner-id');
        const mergedCart = cachedOwner === customerId && window.localStorage.getItem('fieldnotes-cart-merge-pending') !== '1'
          ? await getCustomerCart()
          : await mergeCustomerCart(readLocalCart());
        window.localStorage.setItem('fieldnotes-cart', JSON.stringify(mergedCart));
        window.localStorage.setItem('fieldnotes-cart-owner-id', customerId);
        window.localStorage.removeItem('fieldnotes-cart-merge-pending');
        setNotice(mode === 'register' ? 'Your account is ready and your cart was saved. Check your email to verify your address.' : 'Welcome back. Your cart is up to date.');
      } catch {
        window.localStorage.setItem('fieldnotes-cart-merge-pending', '1');
        setNotice('You are signed in. Your guest cart is still saved on this device and will sync when the connection returns.');
      }
    } catch (requestError) {
      const validationMessage = Object.values(requestError.response?.data?.errors || {}).flat()[0];
      setError(validationMessage || requestError.response?.data?.message || requestError.message || 'Sign in failed.');
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await updateCustomerProfile(profileValues);
      setProfile(updated);
      setNotice(updated.email_verified ? 'Your profile was updated.' : 'Your profile was updated. Check your email to verify the new address.');
    } catch (requestError) {
      setError(requestError.response?.data?.errors?.email?.[0] || requestError.response?.data?.message || 'Profile could not be updated.');
    } finally { setSaving(false); }
  }

  async function resendVerification() {
    setSaving(true);
    setError('');
    try {
      const response = await api.post('/account/email/verification-notification');
      setNotice(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'A verification email could not be sent. Please try again.');
    } finally { setSaving(false); }
  }

  async function saveAddress(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await saveCustomerAddress(addressForm, editingId);
      await refreshAccount();
      setAddressForm(null);
      setEditingId(null);
      setNotice(editingId ? 'Address updated.' : 'Address saved.');
    } catch (requestError) {
      const firstError = Object.values(requestError.response?.data?.errors || {})[0]?.[0];
      setError(firstError || requestError.response?.data?.message || 'Address could not be saved.');
    } finally { setSaving(false); }
  }

  async function removeAddress(address) {
    if (!window.confirm(`Remove the ${address.label} address?`)) return;
    setError('');
    try {
      await deleteCustomerAddress(address.id);
      await refreshAccount();
      setNotice('Address removed.');
    } catch (requestError) { setError(requestError.response?.data?.message || 'Address could not be removed.'); }
  }

  async function cancelOrder(order) {
    if (!window.confirm(`Cancel order ${order.order_number}?`)) return;
    setError('');
    try {
      await cancelCustomerOrder(order.order_number);
      await refreshAccount();
      setNotice(`${order.order_number} was cancelled.`);
    } catch (requestError) {
      setError(requestError.response?.data?.errors?.order?.[0] || requestError.response?.data?.message || 'This order could not be cancelled.');
    }
  }

  async function logout() {
    try { await api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }); } catch {}
    window.localStorage.removeItem('fieldnotes-customer-token');
    window.localStorage.removeItem('fieldnotes-cart');
    window.localStorage.removeItem('fieldnotes-cart-owner-id');
    window.localStorage.removeItem('fieldnotes-cart-merge-pending');
    window.localStorage.removeItem('fieldnotes-cart-merge-payload');
    setToken(''); setProfile({ name: '', email: '' }); setAddresses([]); setOrders([]); setNotice('You have signed out.');
  }

  function addressInput(event) {
    const { name, value, checked, type } = event.target;
    setAddressForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : name === 'country' ? value.toUpperCase() : value }));
  }

  return <div className="marketplace customer-account">
    <header className="market-header"><a className="market-brand" href="/shop" onClick={(event) => { event.preventDefault(); onNavigate('/shop'); }}><span className="market-brand-mark">f.</span><strong>fieldnotes</strong></a><button className="market-admin" type="button" onClick={() => onNavigate('/shop')}><span>Back to</span><strong>Shop</strong></button>{token && <button className="market-admin customer-signout" type="button" onClick={logout}><span>Signed in as</span><strong>Sign out</strong></button>}</header>
    <main className="account-main"><div className="account-welcome"><div><p className="market-hero-kicker">YOUR FIELDNOTES ACCOUNT</p><h1>{token ? `Hello, ${profile.name || 'there'}.` : 'Your orders, all in one place.'}</h1><p>{token ? 'Manage your details, delivery addresses, and orders.' : 'Sign in or create an account to save addresses and keep track of your orders.'}</p></div><span aria-hidden="true">f.</span></div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}{notice && <div className="banner banner-success" role="status">{notice}</div>}
      {token && profile.email_verified === false && <section className="account-verification-banner"><p><strong>Verify your email address</strong><span>We sent a link to {profile.email}. Verify it to keep your account details current.</span></p><button className="button button-quiet" type="button" onClick={resendVerification} disabled={saving}>{saving ? 'Sending…' : 'Resend verification email'}</button></section>}
      {loading ? <section className="account-card account-loading" role="status"><span className="spinner" /> Loading your accountâ€¦</section> : (!token || mode === "reset" || mode === "forgot") ? <section className="account-auth-card"><div className="account-auth-intro"><span className="account-icon">{mode === 'login' ? '↪' : mode === 'register' ? '+' : '•'}</span><h2>{mode === 'login' ? 'Sign in to your account' : mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Choose a new password'}</h2><p>{mode === 'login' ? 'View your orders and manage saved addresses.' : mode === 'register' ? 'Checkout faster next time with saved delivery details.' : mode === 'forgot' ? 'Enter your account email and we will send a reset link if it matches an account.' : `Set a new password for ${authValues.email}.`}</p></div><form className="account-form" onSubmit={submitAuth}>{mode === 'register' && <label className="checkout-field"><span>Your name</span><input autoComplete="name" value={authValues.name} onChange={(event) => setAuthValues((current) => ({ ...current, name: event.target.value }))} required maxLength="255" /></label>}<label className="checkout-field"><span>Email address</span><input type="email" autoComplete="email" value={authValues.email} onChange={(event) => setAuthValues((current) => ({ ...current, email: event.target.value }))} required /></label>{mode !== 'forgot' && <label className="checkout-field"><span>{mode === 'reset' ? 'New password' : 'Password'}</span><input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={authValues.password} onChange={(event) => setAuthValues((current) => ({ ...current, password: event.target.value }))} required minLength={mode === 'login' ? undefined : 10} /></label>}{['register', 'reset'].includes(mode) && <label className="checkout-field"><span>Confirm password</span><input type="password" autoComplete="new-password" value={authValues.password_confirmation} onChange={(event) => setAuthValues((current) => ({ ...current, password_confirmation: event.target.value }))} required minLength="10" /></label>}<button className="checkout-place-order" type="submit" disabled={saving}>{saving ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Reset password'}</button></form>{mode === 'login' && <p className="account-mode-toggle"><button type="button" onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}>Forgot your password?</button></p>}{mode === 'reset' && <p className="account-mode-toggle"><button type="button" onClick={() => { setMode('forgot'); setResetToken(''); window.history.replaceState({}, '', '/account'); }}>Request another reset link</button></p>}{mode !== 'reset' && <p className="account-mode-toggle">{mode === 'register' ? 'Already have an account?' : 'New to Fieldnotes?'} <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); setNotice(''); }}>{mode === 'register' ? 'Sign in' : 'Create an account'}</button></p>}<p className="account-guest-note">You can also place an order as a guest without creating an account.</p></section> : <>
        <nav className="account-tabs" aria-label="Account sections">{[['orders', 'Your orders'], ['addresses', 'Addresses'], ['profile', 'Profile']].map(([value, label]) => <button type="button" key={value} className={tab === value ? 'active' : ''} onClick={() => { setTab(value); setError(''); setNotice(''); }}>{label}</button>)}</nav>
        {tab === 'orders' && <CustomerOrders orders={orders} orderPagination={orderPagination} orderPage={orderPage} setOrderPage={setOrderPage} refreshAccount={refreshAccount} cancelOrder={cancelOrder} onNavigate={onNavigate} />}
        {tab === 'addresses' && <section className="account-card"><div className="account-section-heading"><div><p className="checkout-step">DELIVERY DETAILS</p><h2>Saved addresses</h2></div><button className="account-add-address" type="button" onClick={() => { setAddressForm({ ...emptyAddress, recipient_name: profile.name }); setEditingId(null); }}>+ Add address</button></div>{addresses.length ? <div className="account-address-grid">{addresses.map((address) => <article className="account-address" key={address.id}><div className="account-address-title"><h3>{address.label}</h3>{address.is_default && <span>Default</span>}</div><strong>{address.recipient_name}</strong><p>{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ''}<br />{address.city}, {address.region} {address.postal_code}<br />{address.country}<br />{address.phone}</p><div><button type="button" onClick={() => { const { id, user_id, created_at, updated_at, ...values } = address; setAddressForm(values); setEditingId(id); }}>Edit</button><button type="button" onClick={() => removeAddress(address)}>Remove</button></div></article>)}</div> : <div className="account-empty"><h3>No saved addresses</h3><p>Add an address to make future checkouts faster.</p></div>}{addressForm && <form className="account-address-form" onSubmit={saveAddress}><div className="account-section-heading"><h3>{editingId ? 'Edit address' : 'New address'}</h3><button type="button" className="account-close-form" onClick={() => setAddressForm(null)} aria-label="Close address form">Ã—</button></div><div className="checkout-fields">{[['label','Address label'],['recipient_name','Recipient name'],['phone','Phone'],['address_line1','Street address'],['address_line2','Apartment / suite'],['city','City'],['region','State / region'],['postal_code','ZIP / postal code'],['country','Country code']].map(([name,label]) => <label className={`checkout-field ${['address_line1','address_line2'].includes(name) ? 'wide' : ''}`} key={name}><span>{label}</span><input name={name} value={addressForm[name] || ''} onChange={addressInput} required={name !== 'address_line2'} maxLength={name === 'country' ? 2 : undefined} /></label>)}</div><label className="checkout-consent"><input type="checkbox" name="is_default" checked={Boolean(addressForm.is_default)} onChange={addressInput} /> Make this my default address</label><button className="checkout-place-order" type="submit" disabled={saving}>{saving ? 'Savingâ€¦' : 'Save address'}</button></form>}</section>}
        {tab === 'profile' && <section className="account-card account-profile-card"><div className="account-section-heading"><div><p className="checkout-step">ACCOUNT DETAILS</p><h2>Your profile</h2></div></div><form className="account-form" onSubmit={saveProfile}><label className="checkout-field"><span>Name</span><input autoComplete="name" value={profileValues.name} onChange={(event) => setProfileValues((current) => ({ ...current, name: event.target.value }))} required /></label><label className="checkout-field"><span>Email address</span><input type="email" autoComplete="email" value={profileValues.email} onChange={(event) => setProfileValues((current) => ({ ...current, email: event.target.value }))} required /></label><button className="checkout-place-order" type="submit" disabled={saving}>{saving ? 'Savingâ€¦' : 'Save profile'}</button></form></section>}
      </>}
      <p className="account-admin-link">Managing a store? <button type="button" onClick={() => onNavigate('/login')}>Administrator sign in</button></p>
    </main>
  </div>;
}
