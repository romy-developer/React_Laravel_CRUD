import { useEffect, useState } from 'react';
import ProductForm from './components/ProductForm.jsx';
import ProductList from './components/ProductList.jsx';
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from './services/productService.js';

function errorMessage(error) {
  if (error.response?.status === 404) {
    return 'That product no longer exists. Refresh the list and try again.';
  }

  if (!error.response) {
    return 'Could not reach the API. Check that Laravel is running and the API URL is correct.';
  }

  return error.response.data?.message || 'Something went wrong. Please try again.';
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [listError, setListError] = useState('');
  const [actionError, setActionError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState('');

  async function loadProducts() {
    setLoading(true);
    setListError('');

    try {
      setProducts(await getProducts());
    } catch (error) {
      setListError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  async function handleSave(values) {
    setSaving(true);
    setActionError('');
    setNotice('');
    setFieldErrors({});

    try {
      if (selectedProduct) {
        await updateProduct(selectedProduct.id, values);
        setNotice(`${values.name} was updated.`);
      } else {
        await createProduct(values);
        setNotice(`${values.name} was added to your products.`);
      }

      setSelectedProduct(null);
      await loadProducts();
      return true;
    } catch (error) {
      setActionError(errorMessage(error));
      setFieldErrors(error.response?.data?.errors || {});
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(product.id);
    setActionError('');
    setNotice('');

    try {
      await deleteProduct(product.id);
      if (selectedProduct?.id === product.id) {
        setSelectedProduct(null);
      }
      setNotice(`${product.name} was deleted.`);
      await loadProducts();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  const totalUnits = products.reduce((total, product) => total + Number(product.quantity), 0);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Fieldnotes home">
          <span className="wordmark-icon" aria-hidden="true">f.</span>
          <span>fieldnotes</span>
        </a>
        <span className="topbar-label">PRODUCT INVENTORY</span>
      </header>

      <main className="page-content">
        <section className="page-intro">
          <div>
            <p className="eyebrow">Workspace / Products</p>
            <h1>Good stock, <em>at a glance.</em></h1>
            <p className="intro-copy">A clear view of what you have and what it is worth.</p>
          </div>
          <div className="summary" aria-label="Inventory summary">
            <div className="summary-item">
              <span className="summary-value">{loading ? '...' : products.length}</span>
              <span className="summary-label">Products</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-item">
              <span className="summary-value">{loading ? '...' : totalUnits.toLocaleString()}</span>
              <span className="summary-label">Units on hand</span>
            </div>
          </div>
        </section>

        {listError && <div className="banner banner-error" role="alert">{listError}</div>}
        {actionError && <div className="banner banner-error" role="alert">{actionError}</div>}
        {notice && <div className="banner banner-success" role="status">{notice}</div>}

        <div className="workspace-grid">
          <ProductForm
            product={selectedProduct}
            onSubmit={handleSave}
            onCancel={() => {
              setSelectedProduct(null);
              setFieldErrors({});
              setActionError('');
            }}
            saving={saving}
            errors={fieldErrors}
          />
          <ProductList
            products={products}
            loading={loading}
            error={listError}
            onEdit={(product) => {
              setSelectedProduct(product);
              setActionError('');
              setFieldErrors({});
            }}
            onDelete={handleDelete}
            deletingId={deletingId}
            onRetry={loadProducts}
          />
        </div>
      </main>

      <footer className="page-footer"><span>Fieldnotes inventory</span><span>Product records are stored in your database.</span></footer>
    </div>
  );
}