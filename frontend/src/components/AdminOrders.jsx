import { useEffect, useRef, useState } from 'react';
import { assignAdminOrder, getAdminFulfillmentStaff, getAdminOrders, recordAdminRefund, updateAdminOrder } from '../services/productService.js';
import OrderTimeline from './OrderTimeline.jsx';

const statuses = ['all', 'placed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'];
const nextSteps = { placed: ['processing', 'cancelled'], processing: ['packed', 'cancelled'], packed: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], refunded: [], cancelled: [] };
const money = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount));

export default function AdminOrders({ canRefund = true }) {
  const [filters, setFilters] = useState({ search: '', status: 'all', date_from: '', date_to: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [shipment, setShipment] = useState({ shipping_carrier: '', tracking_number: '' });
  const [refundValues, setRefundValues] = useState({ amount: '', note: '' });
  const [fulfillmentStaff, setFulfillmentStaff] = useState([]);
  const [assigneeId, setAssigneeId] = useState('');
  const refundRequest = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [notice, setNotice] = useState('');
  const allowedNextSteps = selected ? (nextSteps[selected.status] || []).filter((status) => canRefund || status !== 'cancelled') : [];

  async function loadOrders() {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminOrders({ ...filters, status: filters.status === 'all' ? '' : filters.status, page });
      setResult(data);
      if (selected) setSelected(data.data.find((order) => order.order_number === selected.order_number) || selected);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Orders could not be loaded.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadOrders(); }, [filters, page]);

  useEffect(() => {
    if (!canRefund) return undefined;
    let active = true;
    getAdminFulfillmentStaff().then((staff) => { if (active) setFulfillmentStaff(staff); }).catch(() => {});
    return () => { active = false; };
  }, [canRefund]);

  async function changeStatus(order, status) {
    if (status === 'cancelled' && !window.confirm(`Cancel ${order.order_number}? The units will be returned to inventory.`)) return;
    setSaving(true);
    setNotice('');
    setError('');
    setFieldError('');
    try {
      const shipmentDetails = status === 'shipped' ? shipment : {};
      const updated = await updateAdminOrder(order.order_number, status, shipmentDetails);
      setSelected(updated);
      if (status === 'shipped') setShipment({ shipping_carrier: updated.shipping_carrier || '', tracking_number: updated.tracking_number || '' });
      setNotice(`${order.order_number} moved to ${status}.`);
      await loadOrders();
    } catch (requestError) {
      setError(requestError.response?.data?.errors?.status?.[0] || requestError.response?.data?.message || 'The order could not be updated.');
      setFieldError(requestError.response?.data?.errors?.tracking_number?.[0] || requestError.response?.data?.errors?.shipping_carrier?.[0] || '');
    } finally { setSaving(false); }
  }

  function selectOrder(order) {
    setSelected(order);
    setShipment({ shipping_carrier: order.shipping_carrier || '', tracking_number: order.tracking_number || '' });
    setFieldError('');
    setRefundValues({ amount: Math.max(0, Number(order.grand_total) - Number(order.refunded_total || 0)).toFixed(2), note: '' });
    setAssigneeId(order.assigned_to?.id ? String(order.assigned_to.id) : '');
  }

  async function saveAssignment(event) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await assignAdminOrder(selected.order_number, assigneeId);
      setSelected(updated);
      setAssigneeId(updated.assigned_to?.id ? String(updated.assigned_to.id) : '');
      setNotice(updated.assigned_to ? `Assigned to ${updated.assigned_to.name}.` : 'Order returned to the unassigned queue.');
      await loadOrders();
    } catch (requestError) {
      const validationMessage = Object.values(requestError.response?.data?.errors || {}).flat()[0];
      setError(validationMessage || requestError.response?.data?.message || 'The order assignment could not be saved.');
    } finally { setSaving(false); }
  }

  async function submitRefund(event) {
    event.preventDefault();
    if (!selected || saving) return;
    if (!window.confirm(`Record a refund of ${money(refundValues.amount)} for ${selected.order_number}?`)) return;
    setSaving(true);
    setError('');
    setFieldError('');
    setNotice('');
    try {
      const fingerprint = JSON.stringify([selected.order_number, refundValues]);
      if (!refundRequest.current || refundRequest.current.fingerprint !== fingerprint) {
        refundRequest.current = { fingerprint, key: window.crypto?.randomUUID?.() || `refund-${Date.now()}-${Math.random().toString(16).slice(2)}` };
      }
      const key = refundRequest.current.key;
      const result = await recordAdminRefund(selected.order_number, refundValues, key);
      refundRequest.current = null;
      setSelected(result.order);
      setRefundValues({ amount: Math.max(0, Number(result.order.grand_total) - Number(result.order.refunded_total || 0)).toFixed(2), note: '' });
      setNotice(`Refund of ${money(result.refund.amount)} recorded for ${selected.order_number}.`);
      await loadOrders();
    } catch (requestError) {
      const validationMessage = Object.values(requestError.response?.data?.errors || {}).flat()[0];
      setError(validationMessage || requestError.response?.data?.message || 'The refund could not be recorded.');
    } finally { setSaving(false); }
  }

  return <div className="admin-orders-page">
    <section className="orders-summary panel"><div><p className="eyebrow">FULFILLMENT</p><h2>Keep every order moving.</h2><p>Review guest orders and update their fulfillment status.</p></div><div className="orders-total"><strong>{result?.total ?? '—'}</strong><span>Total orders</span></div></section>
    <section className="panel orders-panel">
      <div className="orders-toolbar"><label className="orders-search"><span className="sr-only">Search orders</span><input value={filters.search} onChange={(event) => { setFilters((current) => ({ ...current, search: event.target.value })); setPage(1); }} placeholder="Order number, name, or email" /></label><label className="orders-status-filter"><span className="sr-only">Filter by status</span><select value={filters.status} onChange={(event) => { setFilters((current) => ({ ...current, status: event.target.value })); setPage(1); }}>{statuses.map((status) => <option value={status} key={status}>{status === 'all' ? 'All statuses' : status[0].toUpperCase() + status.slice(1)}</option>)}</select></label></div>
      <div className="orders-date-filters"><label><span>From date</span><input type="date" value={filters.date_from} onChange={(event) => { setFilters((current) => ({ ...current, date_from: event.target.value })); setPage(1); }} /></label><label><span>Through date</span><input type="date" value={filters.date_to} onChange={(event) => { setFilters((current) => ({ ...current, date_to: event.target.value })); setPage(1); }} /></label>{(filters.date_from || filters.date_to || filters.search || filters.status !== 'all') && <button type="button" onClick={() => { setFilters({ search: '', status: 'all', date_from: '', date_to: '' }); setPage(1); }}>Clear filters</button>}</div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}{notice && <div className="banner banner-success" role="status">{notice}</div>}
      <div className="orders-layout"><div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>{loading ? <tr><td colSpan="5" className="orders-empty">Loading orders...</td></tr> : result?.data?.length ? result.data.map((order) => <tr className={selected?.order_number === order.order_number ? 'selected' : ''} key={order.order_number} onClick={() => selectOrder(order)}><td><strong>{order.order_number}</strong><small>{order.items.length} {order.items.length === 1 ? 'line' : 'lines'}</small></td><td>{order.customer_name}<small>{order.email}</small></td><td>{new Date(order.created_at).toLocaleDateString()}</td><td>{money(order.grand_total)}</td><td><span className={`order-status status-${order.status}`}>{order.status}</span></td></tr>) : <tr><td colSpan="5" className="orders-empty">No orders match those filters.</td></tr>}</tbody></table>
      {!loading && result?.last_page > 1 && <nav className="store-pagination" aria-label="Order pages"><button className="button button-quiet" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {result.current_page} of {result.last_page}</span><button className="button button-quiet" type="button" disabled={page >= result.last_page} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}</div>
      {selected && <aside className="order-inspector"><div className="order-inspector-head"><div><p className="eyebrow">ORDER DETAILS</p><h3>{selected.order_number}</h3></div><button type="button" aria-label="Close order details" onClick={() => setSelected(null)}>×</button></div>
        <p><strong>{selected.customer_name}</strong><br /><a href={`mailto:${selected.email}`}>{selected.email}</a><br /><a href={`tel:${selected.phone}`}>{selected.phone}</a></p>
        {selected.address && <p>{selected.address.address_line1}{selected.address.address_line2 ? `, ${selected.address.address_line2}` : ''}<br />{selected.address.city}, {selected.address.region} {selected.address.postal_code}<br />{selected.address.country}</p>}
        {canRefund && <form className="order-assignment-form" onSubmit={saveAssignment}><label>Fulfillment owner<select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Unassigned</option>{fulfillmentStaff.map((staff) => <option value={staff.id} key={staff.id}>{staff.name}</option>)}</select></label><button className="button button-quiet" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save assignment'}</button></form>}
        {canRefund && selected.assignment_history?.length > 0 && <section className="order-assignment-history"><strong>Assignment history</strong>{selected.assignment_history.map((entry, index) => <small key={`${entry.created_at}-${index}`}>{entry.assigned_by || 'Admin'} assigned to {entry.assigned_to || 'unassigned'} · {new Date(entry.created_at).toLocaleString()}</small>)}</section>}
        <div className="order-inspector-lines">{selected.items.map((item, index) => <div key={`${item.product_name}-${index}`}><span>{item.product_name}<small>Qty {item.quantity} × {money(item.unit_price)}</small></span><strong>{money(item.line_total)}</strong></div>)}</div>
        <div className="order-inspector-total"><span>Total · {selected.payment_method.replaceAll('_', ' ')}</span><strong>{money(selected.grand_total)}</strong></div>
        {selected.coupon_code && <p className="shipment-summary">Coupon {selected.coupon_code}<br />Discount: {money(selected.discount_total)}</p>}
        {canRefund && <p className="shipment-summary"><strong>Refunded</strong><br />{money(selected.refunded_total || 0)} of {money(selected.grand_total)}</p>}
        {canRefund && selected.refunds?.length > 0 && <section className="admin-refund-history"><strong>Refund history</strong>{selected.refunds.map((refund) => <p key={refund.id}>{money(refund.amount)} · {new Date(refund.created_at).toLocaleString()}<small>{refund.note}</small></p>)}</section>}
        {canRefund && ['delivered', 'refunded'].includes(selected.status) && ['paid', 'partially_refunded'].includes(selected.payment_status) && Number(selected.refunded_total || 0) < Number(selected.grand_total) && <form className="admin-refund-form" onSubmit={submitRefund}><strong>Record a manual refund</strong><label>Amount<input type="number" min="0.01" max={(Number(selected.grand_total) - Number(selected.refunded_total || 0)).toFixed(2)} step="0.01" value={refundValues.amount} onChange={(event) => setRefundValues((current) => ({ ...current, amount: event.target.value }))} required /></label><label>Reason / note<input value={refundValues.note} maxLength="255" minLength="3" onChange={(event) => setRefundValues((current) => ({ ...current, note: event.target.value }))} required /></label><small>The store must send the money through its payment or cash process. This records the refund and emails the customer.</small><button className="button button-primary" type="submit" disabled={saving || !refundValues.amount || !refundValues.note.trim()}>{saving ? 'Recording…' : 'Record refund'}</button></form>}
        {selected.status === 'packed' && <div className="shipment-fields"><label>Carrier<input value={shipment.shipping_carrier} maxLength={100} onChange={(event) => setShipment((current) => ({ ...current, shipping_carrier: event.target.value }))} placeholder="e.g. UPS" /></label><label>Tracking number<input value={shipment.tracking_number} maxLength={120} onChange={(event) => setShipment((current) => ({ ...current, tracking_number: event.target.value }))} placeholder="Enter tracking number" /></label><small>Required before marking the order shipped.</small>{fieldError && <small role="alert">{fieldError}</small>}</div>}
        {selected.shipping_carrier && <p className="shipment-summary"><strong>Shipment</strong><br />{selected.shipping_carrier} · {selected.tracking_number}{selected.shipped_at ? <><br />Shipped {new Date(selected.shipped_at).toLocaleDateString()}</> : null}</p>}
        <section className="admin-order-history"><strong>Status history</strong><OrderTimeline events={selected.status_history} label={`Status history for ${selected.order_number}`} /></section>
        <label className="order-status-action">Update fulfillment<select disabled={saving || !allowedNextSteps.length} value="" onChange={(event) => event.target.value && changeStatus(selected, event.target.value)}><option value="">{allowedNextSteps.length ? 'Choose next status' : selected.status === 'delivered' || selected.status === 'cancelled' || selected.status === 'refunded' ? 'Order complete' : 'No updates'}</option>{allowedNextSteps.map((status) => <option value={status} key={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label>
        {selected.payment_status && <small className="payment-note">Payment: {selected.payment_status}</small>}
      </aside>}</div>
    </section>
  </div>;
}
