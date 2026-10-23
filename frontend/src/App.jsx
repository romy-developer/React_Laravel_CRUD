import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import ProductDetails from './components/ProductDetails.jsx';
import ProductForm from './components/ProductForm.jsx';
import ProductList from './components/ProductList.jsx';
import Storefront from './components/Storefront.jsx';
import { Checkout, OrderConfirmation } from './components/Checkout.jsx';
import AdminLogin from './components/AdminLogin.jsx';
import AdminOrders from './components/AdminOrders.jsx';
import CustomerAccount from './components/CustomerAccount.jsx';
import AdminPromotions from './components/AdminPromotions.jsx';
import AdminCustomers from './components/AdminCustomers.jsx';
import AdminStaff from './components/AdminStaff.jsx';
import AdminAudit from './components/AdminAudit.jsx';
import StoreProductPage from './components/StoreProductPage.jsx';
import { getCurrentUser, signOut } from './services/authService.js';
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from './services/productService.js';

function resolveRoute(pathname, search = '') {
  const storeProductMatch = pathname.match(/^\/shop\/products\/(?:(.+)-)?(\d+)\/?$/);
  if (storeProductMatch) return { name: 'store-product', id: Number(storeProductMatch[2]) };
  if (pathname === '/') return { name: 'dashboard' };
  if (pathname === '/shop' || pathname === '/shop/') return { name: 'shop' };
  if (pathname === '/account' || pathname === '/account/') return { name: 'account' };
  if (pathname === '/checkout' || pathname === '/checkout/') return { name: 'checkout' };
  if (pathname === '/login' || pathname === '/login/') return { name: 'login' };
  if (pathname === '/orders' || pathname === '/orders/') return { name: 'orders' };
  if (pathname === '/customers' || pathname === '/customers/') return { name: 'customers' };
  if (pathname === '/staff' || pathname === '/staff/') return { name: 'staff' };
  if (pathname === '/audit' || pathname === '/audit/') return { name: 'audit' };
  if (pathname === '/promotions' || pathname === '/promotions/') return { name: 'promotions' };
  const orderMatch = pathname.match(/^\/orders\/(FN-[A-F0-9]+)\/?$/i);
  if (orderMatch) return { name: 'order', orderNumber: orderMatch[1], accessToken: new URLSearchParams(search).get('token') || '' };
  if (pathname === '/products' || pathname === '/products/') return { name: 'products' };
  if (pathname === '/products/create') return { name: 'create' };
  const editMatch = pathname.match(/^\/products\/(\d+)\/edit\/?$/);
  if (editMatch) return { name: 'edit', id: Number(editMatch[1]) };
  const detailMatch = pathname.match(/^\/products\/(\d+)\/?$/);
  if (detailMatch) return { name: 'detail', id: Number(detailMatch[1]) };
  return { name: 'not-found' };
}

function errorMessage(error) {
  if (error.response?.status === 404) return 'This product could not be found.';
  if (!error.response) return 'Could not reach the API. Check that Laravel is running and the API URL is correct.';
  return error.response.data?.message || 'Something went wrong. Please try again.';
}

const pageInfo = {
  dashboard: ['Dashboard', 'A clear view of your product inventory.'],
  shop: ['Online store', 'Preview the customer catalogue and browse available products.'],
  products: ['Products', 'Browse and manage every product in your catalogue.'],
  orders: ['Orders', 'Review guest orders and manage fulfillment.'],
  customers: ['Customers', 'Look up customer accounts, saved addresses, and order history.'],
  staff: ['Team access', 'Manage customer and fulfillment account access.'],
  audit: ['Audit history', 'Review changes made across the store workspace.'],
  promotions: ['Promotions', 'Create discount codes and manage coupon availability.'],
  create: ['Add product', 'Add a new item to your inventory.'],
  edit: ['Edit product', 'Update this product’s information.'],
  detail: ['Product details', 'Review product information and stock levels.'],
  'not-found': ['Page not found', 'The page you requested does not exist.'],
};

export default function App() {
  const [route, setRoute] = useState(() => resolveRoute(window.location.pathname, window.location.search));
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [pageError, setPageError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  async function loadProducts() {
    setLoading(true);
    setPageError('');
    try {
      setProducts(await getProducts());
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (window.localStorage.getItem('fieldnotes-session-token')) {
      getCurrentUser()
        .then((currentUser) => {
          if (!active) return;
          if (!['admin', 'fulfillment'].includes(currentUser.role)) {
            window.localStorage.removeItem('fieldnotes-session-token');
            return;
          }
          setUser(currentUser);
          if (currentUser.role === 'admin') {
            void loadProducts();
          } else {
            setLoading(false);
            window.history.replaceState({}, '', '/orders');
            setRoute({ name: 'orders' });
          }
        })
        .catch(() => window.localStorage.removeItem('fieldnotes-session-token'))
        .finally(() => { if (active) setAuthChecked(true); });
    } else {
      setLoading(false);
      setAuthChecked(true);
    }
    function syncRoute() {
      setRoute(resolveRoute(window.location.pathname, window.location.search));
      setFieldErrors({});
      setPageError('');
    }
    window.addEventListener('popstate', syncRoute);
    return () => { active = false; window.removeEventListener('popstate', syncRoute); };
  }, []);

  function navigate(path) {
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setRoute(resolveRoute(window.location.pathname, window.location.search));
    setPageError('');
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    if (user?.role === 'fulfillment' && route.name !== 'orders') {
      window.history.replaceState({}, '', '/orders');
      setRoute({ name: 'orders' });
    }
  }, [user, route.name]);

  async function handleSave(values) {
    setSaving(true);
    setPageError('');
    setNotice('');
    setFieldErrors({});
    try {
      const saved = route.name === 'edit'
        ? await updateProduct(route.id, values)
        : await createProduct(values);
      setNotice(route.name === 'edit' ? `${saved.name} was updated.` : `${saved.name} was added.`);
      await loadProducts();
      navigate(`/products/${saved.id}`);
      return true;
    } catch (error) {
      setPageError(errorMessage(error));
      setFieldErrors(error.response?.data?.errors || {});
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product) {
    if (!window.confirm(`Delete “${product.name}”? This cannot be undone.`)) return;
    setDeletingId(product.id);
    setPageError('');
    setNotice('');
    try {
      await deleteProduct(product.id);
      setNotice(`${product.name} was deleted.`);
      await loadProducts();
      navigate('/products');
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  const product = products.find((item) => item.id === route.id);
  const [title, subtitle] = pageInfo[route.name] || pageInfo['not-found'];
  const inventoryActive = ['products', 'create', 'edit', 'detail'].includes(route.name);
  const totalUnits = products.reduce((total, item) => total + Number(item.quantity), 0);

  if (route.name === 'checkout') return <Checkout onNavigate={navigate} />;
  if (route.name === 'store-product') return <StoreProductPage productId={route.id} onNavigate={navigate} onAccount={() => navigate('/account')} />;
  if (route.name === 'order') return <OrderConfirmation orderNumber={route.orderNumber} accessToken={route.accessToken} onNavigate={navigate} />;
  if (route.name === 'account') return <CustomerAccount onNavigate={navigate} />;
  if (route.name === 'shop') {
    return <Storefront onAdmin={() => navigate('/login')} onAccount={() => navigate('/account')} onNavigate={navigate} />;
  }
  if (route.name === 'login' || !authChecked || !user) {
    if (!authChecked && route.name !== 'login') return <main className="admin-auth-loading" role="status"><span className="spinner" /> Loading your workspace…</main>;
    return <AdminLogin onShop={() => navigate('/shop')} onSuccess={(currentUser, token) => {
      window.localStorage.setItem('fieldnotes-session-token', token);
      setUser(currentUser);
      setAuthChecked(true);
      if (currentUser.role === 'admin') {
        navigate('/');
        void loadProducts();
      } else {
        setLoading(false);
        navigate('/orders');
      }
    }} />;
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>
          <span className="brand-mark">f.</span>
          <span><strong>fieldnotes</strong><small>{user.role === 'admin' ? 'INVENTORY WORKSPACE' : 'FULFILLMENT WORKSPACE'}</small></span>
        </a>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="side-nav" aria-label="Main navigation">
          {user.role === 'admin' && <>
            <a className={route.name === 'dashboard' ? 'nav-link active' : 'nav-link'} href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}><span className="nav-icon">D</span>Dashboard</a>
            <a className={route.name === 'shop' ? 'nav-link active' : 'nav-link'} href="/shop" onClick={(event) => { event.preventDefault(); navigate('/shop'); }}><span className="nav-icon">↗</span>Online store</a>
            <a className={inventoryActive && route.name !== 'create' ? 'nav-link active' : 'nav-link'} href="/products" onClick={(event) => { event.preventDefault(); navigate('/products'); }}><span className="nav-icon">P</span>Products</a>
          </>}
          <a className={route.name === 'orders' ? 'nav-link active' : 'nav-link'} href="/orders" onClick={(event) => { event.preventDefault(); navigate('/orders'); }}><span className="nav-icon">O</span>Orders</a>
          {user.role === 'admin' && <>
            <a className={route.name === 'customers' ? 'nav-link active' : 'nav-link'} href="/customers" onClick={(event) => { event.preventDefault(); navigate('/customers'); }}><span className="nav-icon">C</span>Customers</a>
            <a className={route.name === 'staff' ? 'nav-link active' : 'nav-link'} href="/staff" onClick={(event) => { event.preventDefault(); navigate('/staff'); }}><span className="nav-icon">T</span>Team access</a>
            <a className={route.name === 'audit' ? 'nav-link active' : 'nav-link'} href="/audit" onClick={(event) => { event.preventDefault(); navigate('/audit'); }}><span className="nav-icon">A</span>Audit history</a>
            <a className={route.name === 'promotions' ? 'nav-link active' : 'nav-link'} href="/promotions" onClick={(event) => { event.preventDefault(); navigate('/promotions'); }}><span className="nav-icon">%</span>Promotions</a>
            <a className={route.name === 'create' ? 'nav-link active' : 'nav-link'} href="/products/create" onClick={(event) => { event.preventDefault(); navigate('/products/create'); }}><span className="nav-icon">+</span>Add product</a>
          </>}
        </nav>
        <div className="sidebar-note"><span className="sidebar-note-dot" />{user.role === 'admin' ? 'Inventory is up to date' : 'Order queue is up to date'}</div>
        <button className="sidebar-signout" type="button" onClick={async () => { try { await signOut(); } catch {} window.localStorage.removeItem('fieldnotes-session-token'); setUser(null); setProducts([]); navigate('/login'); }}>Sign out</button>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div><span className="topbar-overline">{user.role === 'admin' ? 'STORE ADMINISTRATION' : 'FULFILLMENT TEAM'}</span><strong>{user.role === 'admin' ? 'Inventory workspace' : 'Order workspace'}</strong></div>
          <div className="topbar-user"><span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span>{user.name}</span></div>
        </header>

        <main className="page-content">
          <section className="page-heading">
            <div>
              <p className="breadcrumb">Workspace <span>/</span> {title}</p>
              <h1>{title}</h1>
              <p className="intro-copy">{subtitle}</p>
            </div>
            {route.name === 'dashboard' || route.name === 'products' ? (
              <button className="button button-primary heading-action" type="button" onClick={() => navigate('/products/create')}>
                <span aria-hidden="true">＋</span> Add product
              </button>
            ) : null}
          </section>

          {pageError && <div className="banner banner-error" role="alert">{pageError}</div>}
          {notice && <div className="banner banner-success" role="status">{notice}</div>}

          {route.name === 'dashboard' && (
            <Dashboard
              products={products}
              loading={loading}
              totalUnits={totalUnits}
              onView={(item) => navigate(`/products/${item.id}`)}
              onBrowse={() => navigate('/products')}
              onAdd={() => navigate('/products/create')}
              onOrders={() => navigate('/orders')}
            />
          )}

          {route.name === 'products' && (
            <ProductList
              products={products}
              loading={loading}
              error={pageError}
              onView={(item) => navigate(`/products/${item.id}`)}
              onEdit={(item) => navigate(`/products/${item.id}/edit`)}
              onDelete={handleDelete}
              deletingId={deletingId}
              onRetry={loadProducts}
            />
          )}

          {route.name === 'orders' && <AdminOrders canRefund={user.role === 'admin'} />}
          {route.name === 'customers' && <AdminCustomers />}
          {route.name === 'staff' && <AdminStaff />}
          {route.name === 'audit' && <AdminAudit />}
          {route.name === 'promotions' && <AdminPromotions />}

          {(route.name === 'create' || route.name === 'edit') && (
            loading && route.name === 'edit' ? (
              <section className="panel table-state" role="status"><span className="spinner" /> Loading product...</section>
            ) : route.name === 'edit' && !product ? (
              <section className="panel empty-state"><h2>Product not found</h2><button className="button button-primary" type="button" onClick={() => navigate('/products')}>Back to products</button></section>
            ) : (
              <ProductForm
                key={route.name === 'edit' ? `edit-${route.id}` : 'create'}
                product={route.name === 'edit' ? product : null}
                onSubmit={handleSave}
                onCancel={() => navigate(route.name === 'edit' ? `/products/${route.id}` : '/products')}
                saving={saving}
                errors={fieldErrors}
              />
            )
          )}

          {route.name === 'detail' && (
            <ProductDetails
              product={product}
              loading={loading}
              onBack={() => navigate('/products')}
              onEdit={() => navigate(`/products/${route.id}/edit`)}
              onDelete={() => product && handleDelete(product)}
            />
          )}

          {route.name === 'not-found' && (
            <section className="panel empty-state"><h2>We couldn’t find that page</h2><p>Use the navigation to return to your inventory.</p><button className="button button-primary" type="button" onClick={() => navigate('/')}>Go to dashboard</button></section>
          )}
        </main>
        <footer className="page-footer"><span>Fieldnotes inventory</span><span>{loading ? 'Syncing inventory…' : `${products.length} products · ${totalUnits.toLocaleString()} units`}</span></footer>
      </div>
    </div>
  );
}
