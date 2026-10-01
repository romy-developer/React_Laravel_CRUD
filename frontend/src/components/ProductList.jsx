import ProductItem from './ProductItem.jsx';

export default function ProductList({ products, loading, error, onEdit, onDelete, deletingId, onRetry }) {
  return (
    <section className="panel inventory-panel" aria-labelledby="inventory-heading">
      <div className="section-heading inventory-heading">
        <div>
          <p className="eyebrow">Your catalogue</p>
          <h2 id="inventory-heading">Products <span className="count">{products.length}</span></h2>
        </div>
        <span className="updated-note">Synced with your inventory</span>
      </div>

      {loading ? (
        <div className="table-state" role="status"><span className="spinner" /> Loading products...</div>
      ) : error ? (
        <div className="empty-state">
          <h3>Products unavailable</h3>
          <p>Check the API connection, then try again.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <span className="empty-symbol" aria-hidden="true">+</span>
          <h3>No products yet</h3>
          <p>Add your first product to start building the catalogue.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Description</th>
                <th scope="col" className="numeric-cell">Price</th>
                <th scope="col" className="numeric-cell">Quantity</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <ProductItem
                  key={product.id}
                  product={product}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  deleting={deletingId === product.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (error || products.length === 0) && (
        <button className="retry-link" type="button" onClick={onRetry}>Refresh list</button>
      )}
    </section>
  );
}