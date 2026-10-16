function currency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default function Dashboard({ products, loading, totalUnits, onView, onBrowse, onAdd }) {
  const inventoryValue = products.reduce((total, product) => total + Number(product.price) * Number(product.quantity), 0);
  const needsRestock = products.filter((product) => Number(product.quantity) <= 5).length;
  const recentProducts = [...products].slice(0, 5);

  return (
    <div className="dashboard-page">
      <section className="stats-grid" aria-label="Inventory summary">
        <article className="stat-card"><span className="stat-label">Total products</span><strong>{loading ? '—' : products.length}</strong><span className="stat-foot">Items in your catalogue</span><span className="stat-icon">▤</span></article>
        <article className="stat-card"><span className="stat-label">Units in stock</span><strong>{loading ? '—' : totalUnits.toLocaleString()}</strong><span className="stat-foot">Across all products</span><span className="stat-icon">▦</span></article>
        <article className="stat-card"><span className="stat-label">Inventory value</span><strong>{loading ? '—' : currency(inventoryValue)}</strong><span className="stat-foot">Based on current quantity</span><span className="stat-icon">$</span></article>
        <article className="stat-card"><span className="stat-label">Needs attention</span><strong>{loading ? '—' : needsRestock}</strong><span className="stat-foot">Products with 5 units or fewer</span><span className="stat-icon stat-icon-warm">!</span></article>
      </section>

      <section className="dashboard-grid">
        <div className="panel recent-panel">
          <div className="section-heading">
            <div><p className="eyebrow">Latest activity</p><h2>Recently added</h2></div>
            <button className="text-button" type="button" onClick={onBrowse}>View all products <span aria-hidden="true">→</span></button>
          </div>
          {loading ? (
            <div className="table-state"><span className="spinner" /> Loading products...</div>
          ) : recentProducts.length === 0 ? (
            <div className="dashboard-empty"><span className="empty-symbol">＋</span><h3>Your catalogue is ready</h3><p>Add a product to start tracking your inventory.</p><button className="button button-primary" type="button" onClick={onAdd}>Add your first product</button></div>
          ) : (
            <div className="recent-list">
              {recentProducts.map((product) => (
                <button className="recent-row" type="button" key={product.id} onClick={() => onView(product)}>
                  {product.image_url ? <img src={product.image_url} alt="" /> : <span className="recent-thumb">{product.name.slice(0, 1).toUpperCase()}</span>}
                  <span className="recent-product"><strong>{product.name}</strong><small>{product.category || 'Other'} · {product.condition || 'New'}</small></span>
                  <span className="recent-stock"><strong>{Number(product.quantity).toLocaleString()}</strong><small>units</small></span>
                  <span className="recent-price">{currency(Number(product.price))}</span>
                  <span className="recent-chevron" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="panel quick-panel">
          <p className="eyebrow">Quick actions</p>
          <h2>Manage your stock</h2>
          <p className="quick-copy">Keep product information and stock levels current from one place.</p>
          <button className="quick-action" type="button" onClick={onAdd}><span className="quick-action-icon">＋</span><span><strong>Add a product</strong><small>Create a new catalogue entry</small></span><span className="recent-chevron">›</span></button>
          <button className="quick-action" type="button" onClick={onBrowse}><span className="quick-action-icon">▤</span><span><strong>Browse products</strong><small>View and update your catalogue</small></span><span className="recent-chevron">›</span></button>
        </aside>
      </section>
    </div>
  );
}
