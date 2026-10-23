import { useEffect, useState } from 'react';
import { getAdminAuditLogs } from '../services/productService.js';

const actionLabels = {
  'product.created': 'Product created',
  'product.updated': 'Product updated',
  'product.deleted': 'Product deleted',
  'coupon.created': 'Coupon created',
  'coupon.updated': 'Coupon updated',
  'coupon.disabled': 'Coupon disabled',
  'staff.access_granted': 'Access granted',
  'staff.access_removed': 'Access removed',
  'order.assigned': 'Order assigned',
  'order.status_changed': 'Order status changed',
  'order.refunded': 'Refund recorded',
};

export default function AdminAudit() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      getAdminAuditLogs({ search, action, date_from: dateFrom, date_to: dateTo, page })
        .then((data) => { if (active) setResult(data); })
        .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'The audit history could not be loaded.'); })
        .finally(() => { if (active) setLoading(false); });
    }, 160);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, action, dateFrom, dateTo, page]);

  return <div className="admin-customers-page">
    <section className="orders-summary panel"><div><p className="eyebrow">STORE ACTIVITY</p><h2>Changes, with context.</h2><p>Review who changed catalogue, coupon, fulfillment access, and order records.</p></div><div className="orders-total"><strong>{result?.total ?? '—'}</strong><span>Recorded admin actions</span></div></section>
    <section className="panel customers-panel">
      <div className="orders-toolbar">
        <label className="orders-search"><span className="sr-only">Search audit history</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search action, item, or team member" /></label>
        <label className="orders-filter">Action <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }}><option value="">All actions</option>{Object.entries(actionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="orders-filter">From <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></label>
        <label className="orders-filter">To <input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></label>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      <div className="customers-table-wrap"><table className="customers-table"><thead><tr><th>When</th><th>Action</th><th>Details</th><th>Changed by</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="4" className="orders-empty">Loading activity…</td></tr> : result?.data?.length ? result.data.map((entry) => <tr key={entry.id}><td><strong>{new Date(entry.created_at).toLocaleDateString()}</strong><small>{new Date(entry.created_at).toLocaleTimeString()}</small></td><td><span className="customer-verified">{actionLabels[entry.action] || entry.action}</span></td><td><strong>{entry.subject_label || entry.subject_type}</strong><small>{entry.summary}</small></td><td>{entry.actor}</td></tr>) : <tr><td colSpan="4" className="orders-empty">No recorded changes match these filters.</td></tr>}
      </tbody></table>
      {!loading && result?.last_page > 1 && <nav className="store-pagination" aria-label="Audit history pages"><button className="button button-quiet" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {result.current_page} of {result.last_page}</span><button className="button button-quiet" type="button" disabled={page >= result.last_page} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}</div>
    </section>
  </div>;
}
