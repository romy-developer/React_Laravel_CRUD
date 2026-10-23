import { useEffect, useState } from 'react';
import { getAdminCustomer, getAdminCustomers } from '../services/productService.js';
import OrderTimeline from './OrderTimeline.jsx';

function money(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount));
}

export default function AdminCustomers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      getAdminCustomers({ search, page })
        .then((data) => { if (active) setResult(data); })
        .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Customers could not be loaded.'); })
        .finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, page]);

  useEffect(() => {
    if (!selectedId) { setDetails(null); return undefined; }
    let active = true;
    setDetailsLoading(true);
    getAdminCustomer(selectedId)
      .then((data) => { if (active) setDetails(data); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Customer details could not be loaded.'); })
      .finally(() => { if (active) setDetailsLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  return <div className="admin-customers-page">
    <section className="orders-summary panel"><div><p className="eyebrow">CUSTOMER SUPPORT</p><h2>Know who is shopping.</h2><p>Look up registered customers, saved addresses, and their order history.</p></div><div className="orders-total"><strong>{result?.total ?? '—'}</strong><span>Customer accounts</span></div></section>
    <section className="panel customers-panel">
      <div className="orders-toolbar"><label className="orders-search"><span className="sr-only">Search customers</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search by customer name or email" /></label></div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      <div className="customers-layout">
        <div className="customers-table-wrap"><table className="customers-table"><thead><tr><th>Customer</th><th>Orders</th><th>Last order</th><th>Verification</th></tr></thead><tbody>
          {loading ? <tr><td colSpan="4" className="orders-empty">Loading customers…</td></tr> : result?.data?.length ? result.data.map((customer) => <tr className={selectedId === customer.id ? 'selected' : ''} key={customer.id} tabIndex="0" aria-label={`View ${customer.name}`} onClick={() => { setDetails(null); setSelectedId(customer.id); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetails(null); setSelectedId(customer.id); } }}><td><strong>{customer.name}</strong><small>Customer #{customer.id}</small></td><td>{customer.orders_count}</td><td>{customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString() : '—'}</td><td><span className={customer.email_verified ? 'customer-verified' : 'customer-unverified'}>{customer.email_verified ? 'Verified' : 'Unverified'}</span></td></tr>) : <tr><td colSpan="4" className="orders-empty">No customer accounts match this search.</td></tr>}
        </tbody></table>
        {!loading && result?.last_page > 1 && <nav className="store-pagination" aria-label="Customer pages"><button className="button button-quiet" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {result.current_page} of {result.last_page}</span><button className="button button-quiet" type="button" disabled={page >= result.last_page} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}</div>
        {selectedId && <aside className="customer-inspector"><div className="order-inspector-head"><div><p className="eyebrow">CUSTOMER ACCOUNT</p><h3>{details?.customer?.name || 'Loading customer…'}</h3></div><button type="button" aria-label="Close customer details" onClick={() => { setSelectedId(null); setError(''); }}>×</button></div>
          {detailsLoading ? <p role="status">Loading customer details…</p> : details && <>
            <p><a href={`mailto:${details.customer.email}`}>{details.customer.email}</a><br /><span className={details.customer.email_verified ? 'customer-verified' : 'customer-unverified'}>{details.customer.email_verified ? 'Email verified' : 'Email not verified'}</span><br /><small>Account created {new Date(details.customer.created_at).toLocaleDateString()}</small></p>
            <section className="customer-address-list"><strong>Saved addresses ({details.addresses.length})</strong>{details.addresses.length ? details.addresses.map((address) => <article key={address.id}><b>{address.label}{address.is_default ? ' · Default' : ''}</b><span>{address.recipient_name} · {address.phone}</span><span>{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ''}</span><span>{address.city}, {address.region} {address.postal_code}, {address.country}</span></article>) : <small>No saved addresses.</small>}</section>
            <section className="customer-order-list"><strong>Order history ({details.orders.total})</strong>{details.orders.data.length ? details.orders.data.map((order) => <article key={order.order_number}><header><b>{order.order_number}</b><span className={`order-status status-${order.status}`}>{order.status}</span></header><small>{new Date(order.created_at).toLocaleDateString()} · {money(order.grand_total, order.currency)} · {order.payment_status}</small><ul>{order.items.map((item, index) => <li key={`${item.product_name}-${index}`}>{item.product_name} × {item.quantity}</li>)}</ul>{Number(order.refunded_total) > 0 && <small>Refunded {money(order.refunded_total, order.currency)}</small>}<OrderTimeline events={order.status_history} label={`Order history for ${order.order_number}`} /></article>) : <small>No orders yet.</small>}</section>
          </>}
        </aside>}
      </div>
    </section>
  </div>;
}
