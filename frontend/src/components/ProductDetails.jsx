function formatPrice(price) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(price));
}

export default function ProductDetails({ product, loading, onBack, onEdit, onDelete }) {
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
          <img className="details-image" src={product.image_url} alt={product.name} />
        ) : (
          <div className="details-image details-image-placeholder" aria-label="No product image">No image</div>
        )}
        <div className="details-copy">
          <p className="eyebrow">{product.category || 'Other'} · {product.condition || 'New'}</p>
          <h2 id="details-heading">{product.name}</h2>
          <p className="details-price">{formatPrice(product.price)}</p>
          <p className="details-description">{product.description || 'No description provided.'}</p>
          <dl className="details-facts">
            <div><dt>Quantity</dt><dd>{Number(product.quantity).toLocaleString()}</dd></div>
            <div><dt>Category</dt><dd>{product.category || 'Other'}</dd></div>
            <div><dt>Condition</dt><dd>{product.condition || 'New'}</dd></div>
            <div><dt>Product ID</dt><dd>#{product.id}</dd></div>
          </dl>
          <div className="form-actions">
            <button className="button button-primary" type="button" onClick={() => onEdit(product)}>Edit product</button>
            <button className="button button-quiet button-danger" type="button" onClick={onDelete}>Delete product</button>
          </div>
        </div>
      </div>
    </section>
  );
}
