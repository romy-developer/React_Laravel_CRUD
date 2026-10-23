import { useEffect, useState } from 'react';
import { getAdminStaff, updateAdminStaffRole } from '../services/productService.js';

export default function AdminStaff() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadStaff(active = () => true) {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminStaff({ search, role, page });
      if (active()) setResult(data);
    } catch (requestError) {
      if (active()) setError(requestError.response?.data?.message || 'Store access could not be loaded.');
    } finally {
      if (active()) setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => { void loadStaff(() => active); }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, role, page]);

  async function changeRole(user) {
    const nextRole = user.role === 'fulfillment' ? 'customer' : 'fulfillment';
    const message = nextRole === 'customer'
      ? `Remove fulfillment access for ${user.name}? Their active sessions will end and assigned orders will be unassigned.`
      : `Give ${user.name} access to assigned order fulfillment?`;
    if (!window.confirm(message)) return;

    setSavingId(user.id);
    setError('');
    setNotice('');
    try {
      const updated = await updateAdminStaffRole(user.id, nextRole);
      await loadStaff();
      setNotice(`${updated.name} now has ${nextRole === 'fulfillment' ? 'fulfillment' : 'customer'} access.`);
    } catch (requestError) {
      setError(requestError.response?.data?.errors?.role?.[0] || requestError.response?.data?.message || 'Access could not be updated.');
    } finally {
      setSavingId(null);
    }
  }

  return <div className="admin-customers-page">
    <section className="orders-summary panel">
      <div><p className="eyebrow">TEAM ACCESS</p><h2>Manage store access.</h2><p>Give registered customer accounts access to assigned order fulfillment or remove that access.</p></div>
      <div className="orders-total"><strong>{result?.total ?? '—'}</strong><span>Customer and fulfillment accounts</span></div>
    </section>
    <section className="panel customers-panel">
      <div className="orders-toolbar">
        <label className="orders-search"><span className="sr-only">Search store users</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search by name or email" /></label>
        <label className="orders-filter">Role <select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="">All accounts</option><option value="fulfillment">Fulfillment</option><option value="customer">Customers</option></select></label>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {notice && <div className="banner banner-success" role="status">{notice}</div>}
      <div className="customers-table-wrap"><table className="customers-table"><thead><tr><th>Account</th><th>Role</th><th>Assigned orders</th><th>Email</th><th>Action</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="5" className="orders-empty">Loading accounts…</td></tr> : result?.data?.length ? result.data.map((user) => <tr key={user.id}><td><strong>{user.name}</strong><small>Account #{user.id}</small></td><td><span className={user.role === 'fulfillment' ? 'customer-verified' : 'customer-unverified'}>{user.role === 'fulfillment' ? 'Fulfillment' : 'Customer'}</span></td><td>{user.assigned_orders_count}</td><td>{user.email_verified ? 'Verified' : 'Unverified'}</td><td><button className="button button-quiet" type="button" disabled={savingId === user.id} onClick={() => changeRole(user)}>{savingId === user.id ? 'Saving…' : user.role === 'fulfillment' ? 'Remove access' : 'Grant access'}</button></td></tr>) : <tr><td colSpan="5" className="orders-empty">No accounts match this search.</td></tr>}
      </tbody></table>
      {!loading && result?.last_page > 1 && <nav className="store-pagination" aria-label="Staff pages"><button className="button button-quiet" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {result.current_page} of {result.last_page}</span><button className="button button-quiet" type="button" disabled={page >= result.last_page} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}</div>
    </section>
  </div>;
}
