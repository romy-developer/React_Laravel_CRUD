import { useEffect, useState } from 'react';
import { getCustomerCart, getFeaturedProducts, getStorePromotions, getStoreProducts, mergeCustomerCart, previewCoupon, storeProductPath, syncCustomerCart } from '../services/productService.js';
import ProductRating from './ProductRating.jsx';

const initialFilters = { search: '', category: '', min_price: '', max_price: '', availability: '', sort: 'newest' };
const categories = ['Electronics', 'Clothing', 'Home & Kitchen', 'Books', 'Other'];
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function filtersFromUrl() {
  const category = new URLSearchParams(window.location.search).get('category') || '';
  return { ...initialFilters, category: categories.includes(category) ? category : '' };
}

export default function Storefront({ onAdmin, onNavigate, onAccount }) {
  const [filters, setFilters] = useState(filtersFromUrl);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [copiedPromotion, setCopiedPromotion] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState(() => {
    try { const saved = JSON.parse(window.localStorage.getItem('fieldnotes-cart') || '[]'); return Array.isArray(saved) ? saved : []; } catch { return []; }
  });
  const [cartReady, setCartReady] = useState(() => !window.localStorage.getItem('fieldnotes-customer-token'));
  const [cartOpen, setCartOpen] = useState(() => new URLSearchParams(window.location.search).get('cart') === 'open');
  const [cartCouponCode, setCartCouponCode] = useState('');
  const [cartCoupon, setCartCoupon] = useState(null);
  const [cartCouponMessage, setCartCouponMessage] = useState('');
  const cartSignature = cart.map((item) => `${item.id}:${item.quantity}`).join('|');

  useEffect(() => { window.localStorage.setItem('fieldnotes-cart', JSON.stringify(cart)); }, [cart]);

  useEffect(() => {
    setCartCoupon(null);
    setCartCouponMessage('');
  }, [cartSignature]);

  useEffect(() => {
    if (!window.localStorage.getItem('fieldnotes-customer-token')) { setCartReady(true); return undefined; }
    let active = true;
    const mergePending = window.localStorage.getItem('fieldnotes-cart-merge-pending') === '1';
    const loadCart = mergePending ? mergeCustomerCart(cart) : getCustomerCart();
    loadCart
      .then((items) => {
        if (!active) return;
        setCart(items);
        window.localStorage.removeItem('fieldnotes-cart-merge-pending');
      })
      .catch((error) => {
        if (!active || error.response?.status !== 401) return;
        window.localStorage.removeItem('fieldnotes-customer-token');
        if (!mergePending) {
          window.localStorage.removeItem('fieldnotes-cart');
          window.localStorage.removeItem('fieldnotes-cart-owner-id');
        }
      })
      .finally(() => { if (active) setCartReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!cartReady || window.localStorage.getItem('fieldnotes-cart-merge-pending') === '1' || !window.localStorage.getItem('fieldnotes-customer-token')) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      syncCustomerCart(cart).then((items) => {
        if (active && JSON.stringify(items) !== JSON.stringify(cart)) setCart(items);
      }).catch((error) => {
        if (active && error.response?.status === 401) {
          window.localStorage.removeItem('fieldnotes-customer-token');
          window.localStorage.removeItem('fieldnotes-cart');
          window.localStorage.removeItem('fieldnotes-cart-owner-id');
        }
      });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [cart, cartReady]);

  useEffect(() => {
    let active = true;
    getFeaturedProducts().then((products) => { if (active) setFeatured(products); }).catch(() => {});
    getStorePromotions().then((offers) => { if (active) setPromotions(offers); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getStoreProducts({ ...filters, page })
      .then((data) => { if (active) setResult(data); })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'The catalogue could not be loaded. Please try again.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page]);

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
    setPage(1);
  }

  function resetFilters() {
    setFilters(initialFilters);
    setPage(1);
  }

  function addToCart(product, quantity = 1) {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) return current.map((item) => item.id === product.id ? { ...item, available: Number(product.quantity), quantity: Math.min(Number(product.quantity), item.quantity + quantity) } : item);
      return [...current, { id: product.id, name: product.name, price: product.price, image_url: product.image_url, available: Number(product.quantity), quantity: Math.min(Number(product.quantity), quantity) }];
    });
    setCartOpen(true);
  }

  function changeCartQuantity(id, quantity) {
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, Math.min(item.available, quantity)) } : item));
  }

  async function applyCartCoupon() {
    setCartCouponMessage('');
    setCartCoupon(null);
    try {
      const preview = await previewCoupon(cartCouponCode.trim(), cart);
      setCartCoupon(preview);
      setCartCouponCode(preview.code);
      setCartCouponMessage('Discount estimated. Checkout will check this code again.');
    } catch (requestError) {
      setCartCouponMessage(requestError.response?.data?.errors?.coupon_code?.[0] || requestError.response?.data?.errors?.items?.[0] || requestError.response?.data?.message || 'This code could not be applied.');
    }
  }

  async function copyPromotion(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedPromotion(code);
      window.setTimeout(() => setCopiedPromotion(''), 1800);
    } catch {
      setCopiedPromotion('');
    }
  }

  const cartQuantity = cart.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = cart.reduce((total, item) => total + Number(item.price) * item.quantity, 0);
  const cartDiscount = Number(cartCoupon?.discount_total || 0);
  const cartEstimatedTotal = Math.max(0, cartSubtotal - cartDiscount);
  const showFeatured = !filters.search && !filters.category && !filters.min_price && !filters.max_price && filters.availability !== 'in_stock' && page === 1;

  return (
    <div className="marketplace">
      <header className="market-header">
        <a className="market-brand" href="/shop" onClick={(event) => { event.preventDefault(); resetFilters(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="Fieldnotes home"><span className="market-brand-mark">f.</span><strong>fieldnotes</strong></a>
        <div className="market-delivery"><span>DELIVERY</span><strong>Free shipping</strong></div>
        <div className="market-search"><label className="sr-only" htmlFor="market-search-input">Search all products</label><input id="market-search-input" name="search" value={filters.search} onChange={updateFilter} placeholder="Search Fieldnotes" /><button type="button" aria-label="Jump to search results" onClick={() => document.getElementById('market-products')?.scrollIntoView({ behavior: 'smooth' })}>⌕</button></div>
        <button className="market-admin market-account-link" type="button" onClick={onAccount}><span>Your account</span><strong>Sign in / Orders</strong></button>
        <button className="market-admin" type="button" onClick={onAdmin}><span>Store tools</span><strong>Admin</strong></button>
        <button className="market-cart-button" type="button" aria-label={`Open cart, ${cartQuantity} items`} onClick={() => setCartOpen(true)}><span className="market-cart-count">{cartQuantity}</span><span aria-hidden="true">🛒</span><strong>Cart</strong></button>
      </header>
      <nav className="market-nav" aria-label="Shop departments"><span className="market-menu-label">☰ Browse</span>{['', ...categories].map((category) => <button className={filters.category === category ? 'market-category active' : 'market-category'} key={category || 'all'} type="button" onClick={() => { setFilters((current) => ({ ...current, category })); setPage(1); }}>{category || 'All departments'}</button>)}</nav>
      <main className="market-main">
      <section className="market-hero">
        <div><span className="market-hero-kicker">THE FIELDNOTES COLLECTION</span><h1>Everyday finds.<br />Chosen with care.</h1><p>Thoughtful essentials for work, home, and everything in between.</p><button type="button" onClick={() => document.getElementById('market-products')?.scrollIntoView({ behavior: 'smooth' })}>Explore the collection <span aria-hidden="true">→</span></button></div>
        <div className="market-hero-art" aria-hidden="true"><span>f.</span><i /><b /></div>
      </section>

      {showFeatured && featured.length > 0 && <section className="featured-products" aria-labelledby="featured-products-title">
        <div className="featured-heading"><div><p className="eyebrow">A FEW FAVORITES</p><h2 id="featured-products-title">Featured finds</h2></div><button type="button" onClick={() => document.getElementById('market-products')?.scrollIntoView({ behavior: 'smooth' })}>Shop all <span aria-hidden="true">â†’</span></button></div>
        <div className="featured-grid">{featured.map((product) => <article className="featured-card" key={product.id}>
          <button className="featured-image" type="button" onClick={() => onNavigate(storeProductPath(product))} aria-label={`View ${product.name}`}>
            {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <span aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</span>}
          </button>
          <div className="featured-card-copy"><p className="eyebrow">{product.category}</p><a href={storeProductPath(product)} onClick={(event) => { event.preventDefault(); onNavigate(storeProductPath(product)); }}>{product.name}</a><ProductRating product={product} /><div><strong>{currency.format(Number(product.price))}</strong>{Number(product.compare_at_price) > Number(product.price) && <del>{currency.format(Number(product.compare_at_price))}</del>}</div><button type="button" onClick={() => addToCart(product)}>Add to cart</button></div>
        </article>)}</div>
      </section>}

      {showFeatured && promotions.length > 0 && <section className="store-promotion-strip" aria-label="Current store promotions">
        {promotions.map((promotion) => <article className="store-promotion" key={promotion.code}><span className="promotion-spark" aria-hidden="true">%</span><div><strong>{promotion.description || (promotion.discount_type === 'percentage' ? `${promotion.discount_value}% off your order` : `${currency.format(Number(promotion.discount_value))} off your order`)}</strong><small>{promotion.minimum_subtotal > 0 ? `On orders over ${currency.format(Number(promotion.minimum_subtotal))} · ` : ''}Enter code <b>{promotion.code}</b>{promotion.ends_at ? ` · Ends ${new Date(promotion.ends_at).toLocaleDateString()}` : ''}</small></div><button type="button" onClick={() => copyPromotion(promotion.code)}>{copiedPromotion === promotion.code ? 'Copied' : 'Copy code'}</button></article>)}
      </section>}

      <div className="market-content" id="market-products">
      <aside className="market-filters" aria-label="Filter products"><h2>Department</h2><button className={!filters.category ? 'filter-choice selected' : 'filter-choice'} type="button" onClick={() => updateFilter({ target: { name: 'category', value: '' } })}>All products</button>{categories.map((category) => <button className={filters.category === category ? 'filter-choice selected' : 'filter-choice'} type="button" key={category} onClick={() => updateFilter({ target: { name: 'category', value: category } })}>{category}</button>)}<hr /><h2>Price</h2><div className="market-price-range"><label><span className="sr-only">Minimum price</span><input aria-label="Minimum price" name="min_price" type="number" min="0" step="0.01" value={filters.min_price} onChange={updateFilter} placeholder="$ Min" /></label><span>to</span><label><span className="sr-only">Maximum price</span><input aria-label="Maximum price" name="max_price" type="number" min="0" step="0.01" value={filters.max_price} onChange={updateFilter} placeholder="$ Max" /></label></div><hr /><label className="market-stock-filter"><input type="checkbox" name="availability" checked={filters.availability === 'in_stock'} onChange={(event) => updateFilter({ target: { name: 'availability', value: event.target.checked ? 'in_stock' : '' } })} /> In stock only</label><button className="market-clear" type="button" onClick={resetFilters}>Clear all filters</button></aside>
      <section className="market-results" aria-label="Product catalogue">
      <div className="market-result-toolbar"><div><h2>{filters.category || 'Shop all products'}</h2><p>{loading ? 'Finding products…' : `${result?.total ?? 0} ${result?.total === 1 ? 'result' : 'results'}`}</p></div><label>Sort by <select name="sort" value={filters.sort} onChange={updateFilter}><option value="newest">Featured</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="name">Name: A to Z</option></select></label></div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {loading ? <section className="market-loading" role="status"><span className="spinner" /> Loading the collection…</section> : null}
      {!loading && result?.data?.length > 0 && <div className="store-grid">{result.data.map((product) => (
        <article className="store-card" key={product.id}>
          <button className="store-card-image" type="button" onClick={() => onNavigate(storeProductPath(product))} aria-label={`View ${product.name}`}>
            {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <span aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</span>}
            <span className={Number(product.quantity) > 0 ? 'stock-tag' : 'stock-tag out-of-stock'}>{Number(product.quantity) > 0 ? 'In stock' : 'Sold out'}</span>
          </button>
          <div className="store-card-copy"><p className="eyebrow">{product.category} <span>·</span> {product.condition}</p><a className="store-card-title" href={storeProductPath(product)} onClick={(event) => { event.preventDefault(); onNavigate(storeProductPath(product)); }}>{product.name}</a><ProductRating product={product} /><p className="store-card-description">{product.description || 'A considered addition to your everyday.'}</p><div className="store-card-bottom"><div className="market-price-display"><strong>{currency.format(Number(product.price))}</strong>{Number(product.compare_at_price) > Number(product.price) && <del>{currency.format(Number(product.compare_at_price))}</del>}</div><span>{Number(product.quantity) > 0 ? 'In stock' : 'Currently unavailable'}</span></div><button className="market-view-button" type="button" disabled={!Number(product.quantity)} onClick={() => addToCart(product)}>Add to cart</button></div>
        </article>
      ))}</div>}
      {!loading && !error && !result?.data?.length && <section className="panel empty-state"><h2>No products found</h2><p>Try another search or clear your filters to see the full collection.</p><button className="button button-primary" type="button" onClick={resetFilters}>Clear filters</button></section>}
      {!loading && result?.last_page > 1 && <nav className="store-pagination" aria-label="Catalogue pages"><button className="button button-quiet" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {result.current_page} of {result.last_page}</span><button className="button button-quiet" type="button" disabled={page >= result.last_page} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}
      </section></div>
      <footer className="market-footer"><strong>fieldnotes</strong><span>Thoughtful finds for everyday life.</span></footer>
      </main>
      {cartOpen && <div className="market-modal-backdrop market-cart-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}><section className="market-cart-panel" role="dialog" aria-modal="true" aria-labelledby="market-cart-title"><header><h2 id="market-cart-title">Your cart <span>({cartQuantity})</span></h2><button className="market-modal-close" type="button" onClick={() => setCartOpen(false)} aria-label="Close cart">×</button></header>{cart.length ? <><div className="market-cart-items">{cart.map((item) => <article className="market-cart-item" key={item.id}>{item.image_url ? <img src={item.image_url} alt="" /> : <span className="market-cart-thumb">{item.name.slice(0, 1)}</span>}<div><strong>{item.name}</strong><span>{currency.format(Number(item.price))}</span><div className="market-quantity"><button type="button" disabled={item.quantity <= 1} onClick={() => changeCartQuantity(item.id, item.quantity - 1)} aria-label={`Decrease ${item.name} quantity`}>−</button><span>{item.quantity}</span><button type="button" disabled={item.quantity >= item.available} onClick={() => changeCartQuantity(item.id, item.quantity + 1)} aria-label={`Increase ${item.name} quantity`}>+</button><button className="market-remove" type="button" onClick={() => setCart((current) => current.filter((line) => line.id !== item.id))}>Remove</button></div></div></article>)}</div><div className="market-cart-summary"><p><span>Items subtotal</span><strong>{currency.format(cartSubtotal)}</strong></p><p><span>Shipping estimate</span><strong>FREE</strong></p><p><span>Estimated tax</span><strong>{currency.format(0)}</strong></p>{cartCoupon && <p className="market-cart-discount"><span>Discount ({cartCoupon.code})</span><strong>-{currency.format(cartDiscount)}</strong></p>}<p className="market-cart-total"><span>Estimated total</span><strong>{currency.format(cartEstimatedTotal)}</strong></p><small>Shipping is free and no tax is added.</small><div className="market-cart-coupon"><label htmlFor="market-cart-coupon-code">Discount code</label><div><input id="market-cart-coupon-code" value={cartCouponCode} onChange={(event) => { setCartCouponCode(event.target.value.toUpperCase()); setCartCoupon(null); setCartCouponMessage(''); }} maxLength={40} placeholder="Enter code" /><button type="button" onClick={applyCartCoupon} disabled={!cartCouponCode.trim()}>Apply</button></div>{cartCouponMessage && <small className={cartCoupon ? "coupon-success" : "coupon-error"} role="status">{cartCouponMessage}</small>}</div><button type="button" onClick={() => { setCartOpen(false); onNavigate(`/checkout${cartCoupon ? `?coupon=${encodeURIComponent(cartCoupon.code)}` : ""}`); }}>Proceed to checkout</button><small>Your final total and stock are confirmed when your order is placed.</small></div></> : <div className="market-empty-cart"><span aria-hidden="true">🛒</span><h3>Your cart is empty</h3><p>Browse the collection and add something you love.</p><button type="button" onClick={() => { setCartOpen(false); document.getElementById('market-products')?.scrollIntoView({ behavior: 'smooth' }); }}>Continue shopping</button></div>}</section></div>}
    </div>
  );
}
