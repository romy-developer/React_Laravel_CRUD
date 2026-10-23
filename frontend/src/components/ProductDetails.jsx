import { useEffect, useState } from 'react';
import { getInventoryMovements } from '../services/productService.js';

function formatPrice(price) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(price));
}

export default function ProductDetails({ product, loading, onBack, onEdit, onDelete }) {
  const [movementPage, setMovementPage] = useState(1);
  const [movementResult, setMovementResult] = useState(null);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementError, setMovementError] = useState('');

  useEffect(() => {
    if (!product?.id) return undefined;
    let active = true;
    setMovementLoading(true);
    setMovementError('');
    getInventoryMovements(product.id, movementPage)
      .then((result) => { if (active) setMovementResult(result); })
      .catch((error) => { if (active) setMovementError(error.response?.data?.message || 'Stock history could not be loaded.'); })
      .finally(() => { if (active) setMovementLoading(false); });
    return () => { active = false; };
  }, [product?.id, movementPage]);

  if (loading) {
    return <section className="panel details-panel table-state" role="status">Loading product details...</section>;
  }

  if (!product) {
    return (
      <section className="panel details-panel empty-state">
        <h2>Product not found</h2>
        <p>This product may have been removed.</p>
        <button className="button button-primary" type="button" onClick={onBack}>Back to products</button>
      </section>
    );
  }

  return (
    <section className="panel details-panel" aria-labelledby="details-heading">
      <button className="back-link" type="button" onClick={onBack}>← Back to products</button>
      <div className="details-layout">
        {product.image_url ? (
          <div className="details-gallery"><img className="details-image" src={product.image_url} alt={product.name} />{product.images?.length > 1 && <div className="details-gallery-thumbnails" aria-label="Product gallery">{product.images.map((image) => <img key={image.id} src={image.image_url} alt={image.alt_text || product.name} />)}</div>}</div>
        ) : (
          <div className="details-image details-image-placeholder" aria-label="No product image">No image</div>
        )}
        <div className="details-copy">
          <p className="eyebrow">{product.category || 'Other'} · {product.condition || 'New'}</p>
          <h2 id="details-heading">{product.name}</h2>
          <p className="details-price">{formatPrice(product.price)} {Number(product.compare_at_price) > Number(product.price) && <del className="details-compare-price">{formatPrice(product.compare_at_price)}</del>}</p>
          <p className="details-description">{product.description || 'No description provided.'}</p>
          <dl className="details-facts">
            <div><dt>Quantity</dt><dd>{Number(product.quantity).toLocaleString()}</dd></div>
            <div><dt>Category</dt><dd>{product.category || 'Other'}</dd></div>
            <div><dt>Condition</dt><dd>{product.condition || 'New'}</dd></div>
            <div><dt>SKU</dt><dd>{product.sku || 'Not set'}</dd></div>
            <div><dt>Online store</dt><dd>{product.is_published ? 'Published' : 'Draft'}</dd></div>
            <div><dt>Product ID</dt><dd>#{product.id}</dd></div>
          </dl>
          <div className="form-actions">
            <button className="button button-primary" type="button" onClick={() => onEdit(product)}>Edit product</button>
            <button className="button button-quiet button-danger" type="button" onClick={onDelete}>Delete product</button>
          </div>
        </div>
      </div>
      <section className="inventory-history" aria-labelledby="inventory-history-heading">
        <div className="inventory-history-heading"><div><p className="eyebrow">STOCK AUDIT</p><h3 id="inventory-history-heading">Inventory movements</h3></div><span>On hand: {Number(product.quantity).toLocaleString()}</span></div>
        {movementError && <div className="banner banner-error" role="alert">{movementError}</div>}
        <div className="inventory-history-table-wrap"><table className="inventory-history-table"><thead><tr><th>Date</th><th>Change</th><th>Reason</th><th>Actor</th><th>Order / note</th></tr></thead><tbody>{movementLoading ? <tr><td colSpan="5" className="inventory-history-empty">Loading stock history...</td></tr> : movementResult?.data?.length ? movementResult.data.map((movement) => <tr key={movement.id}><td>{new Date(movement.created_at).toLocaleString()}</td><td className={movement.quantity_delta >= 0 ? 'movement-positive' : 'movement-negative'}>{movement.quantity_delta > 0 ? '+' : ''}{movement.quantity_delta}</td><td>{movement.reason.replaceAll('_', ' ')}</td><td>{movement.actor_name || movement.actor_type}</td><td>{movement.order_number ? <strong>{movement.order_number}</strong> : null}{movement.note && <small>{movement.note}</small>}</td></tr>) : <tr><td colSpan="5" className="inventory-history-empty">No stock movements are recorded.</td></tr>}</tbody></table></div>
        {!movementLoading && movementResult?.last_page > 1 && <nav className="store-pagination" aria-label="Inventory movement pages"><button className="button button-quiet" type="button" disabled={movementPage <= 1} onClick={() => setMovementPage((page) => page - 1)}>Previous</button><span>Page {movementResult.current_page} of {movementResult.last_page}</span><button className="button button-quiet" type="button" disabled={movementPage >= movementResult.last_page} onClick={() => setMovementPage((page) => page + 1)}>Next</button></nav>}
      </section>
    </section>
  );
}
