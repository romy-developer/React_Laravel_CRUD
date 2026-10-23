import { useEffect, useState } from 'react';
import { getStoreProduct, storeProductPath, syncCustomerCart } from '../services/productService.js';
import ProductRating from './ProductRating.jsx';
import ProductReviews from './ProductReviews.jsx';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function readCart() {
  try { const cart = JSON.parse(window.localStorage.getItem('fieldnotes-cart') || '[]'); return Array.isArray(cart) ? cart : []; }
  catch { return []; }
}

export default function StoreProductPage({ productId, onNavigate, onAccount }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [notice, setNotice] = useState('');
  const [cartCount, setCartCount] = useState(() => readCart().reduce((count, item) => count + Number(item.quantity), 0));
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getStoreProduct(productId)
      .then((response) => { if (active) { setData(response); setSelectedImage(0); } })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.status === 404 ? 'This product is no longer available.' : 'We could not load this product. Please try again.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);

  useEffect(() => {
    if (!data?.product) return undefined;
    const { product } = data;
    const previousTitle = document.title;
    let description = document.querySelector('meta[name="description"]');
    const createdDescription = !description;
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    const previousDescription = description.content;
    document.title = `${product.name} | Fieldnotes`;
    description.content = product.description || `${product.name} available from Fieldnotes.`;
    let canonical = document.querySelector('link[rel="canonical"]');
    const createdCanonical = !canonical;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    const previousCanonical = canonical.href;
    canonical.href = `${window.location.origin}${storeProductPath(product)}`;
    return () => {
      document.title = previousTitle;
      if (createdDescription) description.remove(); else description.content = previousDescription;
      if (createdCanonical) canonical.remove(); else canonical.href = previousCanonical;
    };
  }, [data]);

  async function addToCart() {
    if (!data?.product || adding) return;
    const product = data.product;
    const cart = readCart();
    const current = cart.find((item) => Number(item.id) === Number(product.id));
    const next = current
      ? cart.map((item) => Number(item.id) === Number(product.id)
        ? { ...item, name: product.name, price: product.price, image_url: product.image_url, available: Number(product.quantity), quantity: Math.min(Number(product.quantity), Number(item.quantity) + 1) }
        : item)
      : [...cart, { id: product.id, name: product.name, price: product.price, image_url: product.image_url, available: Number(product.quantity), quantity: 1 }];
    setAdding(true);
    setAdded(false);
    setNotice('');
    window.localStorage.setItem('fieldnotes-cart', JSON.stringify(next));
    setCartCount(next.reduce((count, item) => count + Number(item.quantity), 0));
    try {
      if (window.localStorage.getItem('fieldnotes-customer-token')) {
        const canonical = await syncCustomerCart(next);
        window.localStorage.setItem('fieldnotes-cart', JSON.stringify(canonical));
        setCartCount(canonical.reduce((count, item) => count + Number(item.quantity), 0));
      }
      setAdded(true);
      setNotice(`${product.name} was added to your cart.`);
    } catch (requestError) {
      if (requestError.response?.status === 401) window.localStorage.removeItem('fieldnotes-customer-token');
      setAdded(true);
      setNotice('Your item is saved in this browser. Sign in again to sync it to your account.');
    } finally { setAdding(false); }
  }

  const product = data?.product;
  return <div className="marketplace store-product-page">
    <header className="market-header"><a className="market-brand" href="/shop" onClick={(event) => { event.preventDefault(); onNavigate('/shop'); }}><span className="market-brand-mark">f.</span><strong>fieldnotes</strong></a><div className="market-delivery"><span>DELIVERY</span><strong>Free shipping</strong></div><button className="market-admin market-account-link" type="button" onClick={onAccount}><span>Your account</span><strong>Sign in / Orders</strong></button><button className="market-cart-button" type="button" onClick={() => onNavigate('/shop?cart=open')} aria-label={`Open cart, ${cartCount} items in cart`}><span className="market-cart-count">{cartCount}</span><span aria-hidden="true">Cart</span></button></header>
    <main className="store-product-main">
      <nav className="product-breadcrumbs" aria-label="Breadcrumb"><button type="button" onClick={() => onNavigate('/shop')}>Shop</button><span aria-hidden="true">/</span>{product?.category && <><button type="button" onClick={() => onNavigate(`/shop?category=${encodeURIComponent(product.category)}`)}>{product.category}</button><span aria-hidden="true">/</span></>}<span>{loading ? 'Loading product...' : product?.name || 'Product unavailable'}</span></nav>
      {loading ? <section className="store-product-state" role="status"><span className="spinner" /> Loading product details...</section> : error ? <section className="panel store-product-state"><h1>Product unavailable</h1><p>{error}</p><button className="button button-primary" type="button" onClick={() => onNavigate('/shop')}>Back to shop</button></section> : product && <>
        <section className="store-product-detail">
          <div className="store-product-gallery"><div className="store-product-image">{(product.images?.[selectedImage]?.image_url || product.image_url) ? <img src={product.images?.[selectedImage]?.image_url || product.image_url} alt={product.images?.[selectedImage]?.alt_text || product.name} /> : <span aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</span>}</div>{product.images?.length > 1 && <div className="store-product-thumbnails" role="group" aria-label="Product images">{product.images.map((image, index) => <button type="button" key={image.id} aria-label={`View image ${index + 1} of ${product.images.length}`} aria-pressed={selectedImage === index} onClick={() => setSelectedImage(index)}><img src={image.image_url} alt="" /></button>)}</div>}</div>
          <div className="store-product-info"><p className="market-hero-kicker">{product.category} · {product.condition}</p><h1>{product.name}</h1><ProductRating product={product} />{product.sku && <p className="store-product-sku">SKU {product.sku}</p>}<div className="store-product-price"><strong>{money.format(Number(product.price))}</strong>{Number(product.compare_at_price) > Number(product.price) && <del>{money.format(Number(product.compare_at_price))}</del>}</div><p className={Number(product.quantity) > 0 ? 'store-product-stock' : 'store-product-stock unavailable'}>{Number(product.quantity) > 0 ? `In stock · ${product.quantity} available` : 'Currently unavailable'}</p><p className="store-product-description">{product.description || 'A considered addition to your everyday.'}</p><section className="store-product-purchase"><strong>Delivery</strong><span>Free shipping</span><strong>Payment</strong><span>Cash on delivery</span><button className="market-add-button" type="button" disabled={!Number(product.quantity) || adding} onClick={addToCart}>{adding ? 'Adding...' : added ? 'Add one more' : 'Add to cart'}</button>{notice && <p role="status">{notice}</p>}{added && <button className="checkout-place-order" type="button" onClick={() => onNavigate('/checkout')}>Proceed to checkout</button>}</section></div>
        </section>
        <ProductReviews productId={product.id} onAccount={onAccount} />
        {data.related?.length > 0 && <section className="store-related"><div><p className="eyebrow">MORE TO EXPLORE</p><h2>Related finds</h2></div><div className="store-related-grid">{data.related.map((item) => <a href={storeProductPath(item)} key={item.id} onClick={(event) => { event.preventDefault(); onNavigate(storeProductPath(item)); }}><span className="store-related-image">{item.image_url ? <img src={item.image_url} alt="" loading="lazy" /> : item.name.slice(0, 1)}</span><strong>{item.name}</strong><span>{money.format(Number(item.price))}</span></a>)}</div></section>}
      </>}
    </main>
    <footer className="market-footer"><strong>fieldnotes</strong><span>Thoughtful finds for everyday life.</span></footer>
  </div>;
}
