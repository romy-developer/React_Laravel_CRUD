import { useEffect, useState } from 'react';
import { disableAdminCoupon, getAdminCoupons, saveAdminCoupon } from '../services/productService.js';

const freshCoupon = { code: '', description: '', discount_type: 'percentage', discount_value: '', minimum_subtotal: '0', max_redemptions: '', is_active: true, is_promoted: false, starts_at: '', ends_at: '' };
const currency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function AdminPromotions() {
  const [coupons, setCoupons] = useState([]);
  const [values, setValues] = useState(freshCoupon);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    setLoading(true);
    try { setCoupons(await getAdminCoupons()); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Promotions could not be loaded.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  function edit(coupon) {
    setEditingId(coupon.id);
    setValues({
      code: coupon.code,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      minimum_subtotal: coupon.minimum_subtotal,
      max_redemptions: coupon.max_redemptions || '',
      is_active: coupon.is_active,
      is_promoted: coupon.is_promoted,
      starts_at: localDateTime(coupon.starts_at),
      ends_at: localDateTime(coupon.ends_at),
    });
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await saveAdminCoupon({
        ...values,
        code: values.code.trim().toUpperCase(),
        discount_value: Number(values.discount_value),
        minimum_subtotal: Number(values.minimum_subtotal || 0),
        max_redemptions: values.max_redemptions ? Number(values.max_redemptions) : null,
        starts_at: values.starts_at || null,
        ends_at: values.ends_at || null,
      }, editingId);
      setNotice(`${saved.code} ${editingId ? 'updated' : 'created'}.`);
      setValues(freshCoupon);
      setEditingId(null);
      await refresh();
    } catch (requestError) {
      const firstError = Object.values(requestError.response?.data?.errors || {})[0]?.[0];
      setError(firstError || requestError.response?.data?.message || 'Promotion could not be saved.');
    } finally { setSaving(false); }
  }

  async function disable(coupon) {
    if (!window.confirm(`Disable ${coupon.code}? Existing orders will keep their discount record.`)) return;
    setError('');
    try {
      await disableAdminCoupon(coupon.id);
      setNotice(`${coupon.code} disabled.`);
      await refresh();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Coupon could not be disabled.'); }
  }

  function change(event) {
    const { name, value, checked, type } = event.target;
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  return <div className="promotions-layout">
    <section className="panel promotion-form-panel"><div className="section-heading"><div><p className="eyebrow">DISCOUNTS</p><h2>{editingId ? 'Edit coupon' : 'Create a coupon'}</h2></div></div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}{notice && <div className="banner banner-success" role="status">{notice}</div>}
      <form className="promotion-form" onSubmit={submit}>
        <label>Code<input name="code" value={values.code} onChange={change} required maxLength={40} autoCapitalize="characters" placeholder="WELCOME10" /></label>
        <label>Description<input name="description" value={values.description} onChange={change} maxLength={160} placeholder="Welcome discount" /></label>
        <div className="promotion-pair"><label>Discount type<select name="discount_type" value={values.discount_type} onChange={change}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></label><label>{values.discount_type === 'percentage' ? 'Percent off' : 'Amount off'}<input name="discount_value" type="number" min="0.01" max={values.discount_type === 'percentage' ? 100 : undefined} step="0.01" value={values.discount_value} onChange={change} required /></label></div>
        <label>Minimum order subtotal<input name="minimum_subtotal" type="number" min="0" step="0.01" value={values.minimum_subtotal} onChange={change} /></label>
        <label>Maximum redemptions<input name="max_redemptions" type="number" min="1" step="1" value={values.max_redemptions} onChange={change} placeholder="No limit" /></label>
        <div className="promotion-pair"><label>Starts at<input name="starts_at" type="datetime-local" value={values.starts_at} onChange={change} /></label><label>Ends at<input name="ends_at" type="datetime-local" value={values.ends_at} onChange={change} /></label></div>
        <label className="promotion-active"><input name="is_active" type="checkbox" checked={Boolean(values.is_active)} onChange={change} /> Coupon is active</label>
        <label className="promotion-active"><input name="is_promoted" type="checkbox" checked={Boolean(values.is_promoted)} onChange={change} /> Show this promotion on the storefront while it is valid</label>
        <div className="promotion-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Save changes' : 'Create coupon'}</button>{editingId && <button className="button button-quiet" type="button" onClick={() => { setValues(freshCoupon); setEditingId(null); }}>Cancel</button>}</div>
      </form>
    </section>
    <section className="panel promotions-list-panel"><div className="section-heading"><div><p className="eyebrow">STORE PROMOTIONS</p><h2>Coupon codes</h2></div><span>{coupons.length} total</span></div>
      {loading ? <div className="table-state"><span className="spinner" /> Loading coupons...</div> : coupons.length ? <div className="promotion-list">{coupons.map((coupon) => <article className="promotion-row" key={coupon.id}><div><strong>{coupon.code}</strong><small>{coupon.description || (coupon.discount_type === 'percentage' ? `${coupon.discount_value}% off` : `${currency(coupon.discount_value)} off`)} · {coupon.redemptions_count} used</small><small>Minimum {currency(coupon.minimum_subtotal)}{coupon.max_redemptions ? ` · Limit ${coupon.max_redemptions}` : ''}</small></div><span className={coupon.is_active ? 'promotion-state active' : 'promotion-state'}>{coupon.is_active ? 'Active' : 'Disabled'}</span><div className="promotion-row-actions"><button type="button" onClick={() => edit(coupon)}>Edit</button>{coupon.is_active && <button type="button" onClick={() => disable(coupon)}>Disable</button>}</div></article>)}</div> : <div className="account-empty"><h3>No coupon codes yet</h3><p>Create a promotion code for shoppers to use at checkout.</p></div>}
    </section>
  </div>;
}
