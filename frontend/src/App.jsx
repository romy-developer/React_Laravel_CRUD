import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import ProductDetails from './components/ProductDetails.jsx';
import ProductForm from './components/ProductForm.jsx';
import ProductList from './components/ProductList.jsx';
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from './services/productService.js';

function resolveRoute(pathname) {
  if (pathname === '/') return { name: 'dashboard' };
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
  products: ['Products', 'Browse and manage every product in your catalogue.'],
  create: ['Add product', 'Add a new item to your inventory.'],
  edit: ['Edit product', 'Update this product’s information.'],
  detail: ['Product details', 'Review product information and stock levels.'],
  'not-found': ['Page not found', 'The page you requested does not exist.'],
};

export default function App() {
  const [route, setRoute] = useState(() => resolveRoute(window.location.pathname));
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [pageError, setPageError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState('');

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
    void loadProducts();
    function syncRoute() {
      setRoute(resolveRoute(window.location.pathname));
      setFieldErrors({});
      setPageError('');
    }
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  function navigate(path) {
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setRoute(resolveRoute(path));
    setPageError('');
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>
          <span className="brand-mark">f.</span>
          <span><strong>fieldnotes</strong><small>INVENTORY WORKSPACE</small></span>
        </a>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="side-nav" aria-label="Main navigation">
          <a className={route.name === 'dashboard' ? 'nav-link active' : 'nav-link'} href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>
            <span className="nav-icon">⌂</span>Dashboard
          </a>
          <a className={inventoryActive && route.name !== 'create' ? 'nav-link active' : 'nav-link'} href="/products" onClick={(event) => { event.preventDefault(); navigate('/products'); }}>
            <span className="nav-icon">▤</span>Products
          </a>
          <a className={route.name === 'create' ? 'nav-link active' : 'nav-link'} href="/products/create" onClick={(event) => { event.preventDefault(); navigate('/products/create'); }}>
            <span className="nav-icon">＋</span>Add product
          </a>
        </nav>
        <div className="sidebar-note"><span className="sidebar-note-dot" />Inventory is up to date</div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div><span className="topbar-overline">PRODUCT MANAGEMENT</span><strong>Inventory workspace</strong></div>
          <div className="topbar-user"><span className="user-avatar">FN</span><span>Workspace</span></div>
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
