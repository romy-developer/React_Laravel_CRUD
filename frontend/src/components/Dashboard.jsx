import { useEffect, useState } from 'react';
import api from '../services/api.js';

function currency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value) || 0);
}

export default function Dashboard({ products, loading, totalUnits, onView, onBrowse, onAdd, onOrders }) {
  const [commerce, setCommerce] = useState(null);
  const [commerceError, setCommerceError] = useState(false);
  useEffect(() => {
    let active = true;
    api.get('/admin/dashboard')
      .then(({ data }) => { if (active) setCommerce(data.data); })
      .catch(() => { if (active) setCommerceError(true); });
    return () => { active = false; };
  }, []);

  const needsRestock = products.filter((product) => Number(product.quantity) <= 5).length;
  const lowStockProducts = [...products].filter((product) => Number(product.quantity) <= 5).sort((left, right) => Number(left.quantity) - Number(right.quantity)).slice(0, 5);
  const recentProducts = [...products].slice(0, 5);

  return (
    <div className="dashboard-page">
      <section className="stats-grid" aria-label="Store summary">
        <article className="stat-card"><span className="stat-label">Orders today</span><strong>{commerce ? commerce.orders_today : '—'}</strong><span className="stat-foot">{commerce ? `${commerce.pending_orders} need fulfillment` : commerceError ? 'Order summary unavailable' : 'Loading order activity'}</span><span className="stat-icon" aria-hidden="true">↗</span></article>
        <article className="stat-card"><span className="stat-label">Paid revenue</span><strong>{commerce ? currency(commerce.paid_revenue) : '—'}</strong><span className="stat-foot">{commerce ? `${currency(commerce.paid_revenue_today)} today` : 'Confirmed payments'}</span><span className="stat-icon" aria-hidden="true">$</span></article>
        <article className="stat-card"><span className="stat-label">Units in stock</span><strong>{loading ? '—' : totalUnits.toLocaleString()}</strong><span className="stat-foot">Across {products.length} products</span><span className="stat-icon" aria-hidden="true">▦</span></article>
        <article className="stat-card"><span className="stat-label">Needs attention</span><strong>{loading ? '—' : needsRestock}</strong><span className="stat-foot">Products with 5 units or fewer</span><span className="stat-icon stat-icon-warm" aria-hidden="true">!</span></article>
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
            <div className="dashboard-empty"><span className="empty-symbol">+</span><h3>Your catalogue is ready</h3><p>Add a product to start tracking your inventory.</p><button className="button button-primary" type="button" onClick={onAdd}>Add your first product</button></div>
          ) : (
            <div className="recent-list">
              {recentProducts.map((product) => (
                <button className="recent-row" type="button" key={product.id} onClick={() => onView(product)}>
                  {product.image_url ? <img src={product.image_url} alt="" /> : <span className="recent-thumb">{product.name.slice(0, 1).toUpperCase()}</span>}
                  <span className="recent-product"><strong>{product.name}</strong><small>{product.category || 'Other'} · {product.condition || 'New'}</small></span>
                  <span className="recent-stock"><strong>{Number(product.quantity).toLocaleString()}</strong><small>units</small></span>
                  <span className="recent-price">{currency(product.price)}</span>
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
          <button className="quick-action" type="button" onClick={onAdd}><span className="quick-action-icon">+</span><span><strong>Add a product</strong><small>Create a new catalogue entry</small></span><span className="recent-chevron">›</span></button>
          <button className="quick-action" type="button" onClick={onBrowse}><span className="quick-action-icon">▤</span><span><strong>Browse products</strong><small>View and update your catalogue</small></span><span className="recent-chevron">›</span></button>
          <button className="dashboard-orders-note" type="button" onClick={onOrders}><strong>{commerce?.recent_orders?.length ?? 0}</strong><span>recent orders on file · View orders</span></button>
        </aside>
      </section>

      <section className="dashboard-lower-grid">
        <div className="panel dashboard-activity-panel">
          <div className="section-heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h2>Recent orders</h2></div><button className="text-button" type="button" onClick={onOrders}>All orders <span aria-hidden="true">→</span></button></div>
          {commerce?.recent_orders?.length ? <div className="dashboard-order-list">{commerce.recent_orders.map((order) => <button className="dashboard-order-row" type="button" key={order.order_number} onClick={onOrders}><span><strong>{order.order_number}</strong><small>{order.customer_name} · {new Date(order.created_at).toLocaleDateString()}</small></span><span className={`order-status status-${order.status}`}>{order.status}</span><strong>{currency(order.grand_total)}</strong></button>)}</div> : <p className="dashboard-list-empty">{commerceError ? 'Recent orders are unavailable.' : commerce ? 'Orders will appear here after the first checkout.' : 'Loading recent orders…'}</p>}
        </div>

        <div className="panel dashboard-restock-panel">
          <div className="section-heading"><div><p className="eyebrow">INVENTORY ALERTS</p><h2>Needs replenishment</h2></div><span>{loading ? '…' : `${needsRestock} products`}</span></div>
          {loading ? <div className="table-state"><span className="spinner" /> Checking inventory…</div> : lowStockProducts.length ? <div className="dashboard-restock-list">{lowStockProducts.map((product) => <button className="dashboard-restock-row" type="button" key={product.id} onClick={() => onView(product)}><span className="dashboard-restock-thumb">{product.image_url ? <img src={product.image_url} alt="" /> : product.name.slice(0, 1).toUpperCase()}</span><span><strong>{product.name}</strong><small>{product.is_published ? 'Published' : 'Draft'} · {product.category || 'Other'}</small></span><b className={Number(product.quantity) === 0 ? 'out' : ''}>{Number(product.quantity) === 0 ? 'Out of stock' : `${product.quantity} left`}</b></button>)}</div> : <p className="dashboard-list-empty">All products have more than 5 units in stock.</p>}
        </div>
      </section>
    </div>
  );
}
