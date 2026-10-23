import { useEffect, useMemo, useRef, useState } from 'react';
import { cancelPrivateOrder, getCustomerCheckoutDetails, getOrder, mergeCustomerCart, placeOrder, previewCoupon, syncCustomerCart } from '../services/productService.js';
import OrderTimeline from './OrderTimeline.jsx';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const emptyAddress = { customer_name: '', email: '', phone: '', address_line1: '', address_line2: '', city: '', region: '', postal_code: '', country: 'US', accept_policy: false, save_address: false };

function readCart() {
  try { const saved = JSON.parse(window.localStorage.getItem('fieldnotes-cart') || '[]'); return Array.isArray(saved) ? saved : []; } catch { return []; }
}

export function Checkout({ onNavigate }) {
  const [cart, setCart] = useState(readCart);
  const [values, setValues] = useState(emptyAddress);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [couponCode, setCouponCode] = useState(() => new URLSearchParams(window.location.search).get('coupon') || '');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [cartSyncing, setCartSyncing] = useState(() => Boolean(window.localStorage.getItem('fieldnotes-customer-token') && window.localStorage.getItem('fieldnotes-cart-merge-pending') === '1'));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const accessToken = useRef(crypto.randomUUID());
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0), [cart]);
  const discount = Number(appliedCoupon?.discount_total || 0);

  async function applyCoupon() {
    setCheckingCoupon(true);
    setCouponMessage('');
    setAppliedCoupon(null);
    try {
      const preview = await previewCoupon(couponCode.trim(), cart);
      setAppliedCoupon(preview);
      setCouponCode(preview.code);
      setCouponMessage('Coupon applied. The discount will be checked again when you place the order.');
    } catch (error) {
      setCouponMessage(error.response?.data?.errors?.coupon_code?.[0] || error.response?.data?.errors?.items?.[0] || error.response?.data?.message || 'This coupon could not be applied.');
    } finally { setCheckingCoupon(false); }
  }

  useEffect(() => {
    if (!window.localStorage.getItem('fieldnotes-customer-token')) return;
    getCustomerCheckoutDetails().then(({ profile, addresses }) => {
      setSavedAddresses(addresses);
      const defaultAddress = addresses.find((address) => address.is_default);
      setValues((current) => ({
        ...current,
        customer_name: profile.name,
        email: profile.email,
        ...(defaultAddress ? {
          phone: defaultAddress.phone,
          address_line1: defaultAddress.address_line1,
          address_line2: defaultAddress.address_line2 || '',
          city: defaultAddress.city,
          region: defaultAddress.region,
          postal_code: defaultAddress.postal_code,
          country: defaultAddress.country,
        } : {}),
      }));
      if (defaultAddress) setSelectedAddressId(String(defaultAddress.id));
    }).catch(() => { window.localStorage.removeItem('fieldnotes-customer-token'); });
  }, []);

  useEffect(() => {
    if (!window.localStorage.getItem('fieldnotes-customer-token') || window.localStorage.getItem('fieldnotes-cart-merge-pending') !== '1') return;
    let active = true;
    mergeCustomerCart(cart).then((items) => {
      if (!active) return;
      setCart(items);
      window.localStorage.setItem('fieldnotes-cart', JSON.stringify(items));
      window.localStorage.removeItem('fieldnotes-cart-merge-pending');
    }).catch(() => {
      if (active) setMessage('Your account cart could not sync yet. Check your connection before placing this order.');
    }).finally(() => { if (active) setCartSyncing(false); });
    return () => { active = false; };
  }, []);

  function update(event) {
    const { name, value, checked, type } = event.target;
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setErrors((current) => ({ ...current, [name]: null }));
    if (name !== 'accept_policy' && name !== 'save_address') setSelectedAddressId('');
  }

  function selectAddress(event) {
    const address = savedAddresses.find((item) => String(item.id) === event.target.value);
    setSelectedAddressId(event.target.value);
    if (!address) return;
    setValues((current) => ({ ...current, customer_name: address.recipient_name, phone: address.phone, address_line1: address.address_line1, address_line2: address.address_line2 || '', city: address.city, region: address.region, postal_code: address.postal_code, country: address.country }));
  }

  async function submit(event) {
    event.preventDefault();
    if (cartSyncing || window.localStorage.getItem('fieldnotes-cart-merge-pending') === '1') {
      setMessage('Wait for your account cart to finish syncing before placing this order.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    setErrors({});
    try {
      const order = await placeOrder({ ...values, coupon_code: appliedCoupon?.code || '' }, cart, idempotencyKey.current, accessToken.current);
      window.localStorage.removeItem('fieldnotes-cart');
      window.localStorage.removeItem('fieldnotes-cart-merge-pending');
      window.localStorage.removeItem('fieldnotes-cart-merge-payload');
      if (window.localStorage.getItem('fieldnotes-customer-token')) {
        try { await syncCustomerCart([]); } catch { /* Order placement already succeeded. */ }
      }
      onNavigate(`/orders/${encodeURIComponent(order.order_number)}?token=${encodeURIComponent(order.access_token)}`);
    } catch (error) {
      if (error.response?.status === 401) window.localStorage.removeItem('fieldnotes-customer-token');
      setMessage(error.response?.data?.message || 'We could not place your order. Check your connection and try again.');
      setErrors(error.response?.data?.errors || {});
    } finally {
      setSubmitting(false);
    }
  }

  if (!cart.length) return <div className="marketplace market-checkout"><header className="market-header"><a className="market-brand" href="/shop" onClick={(event) => { event.preventDefault(); onNavigate('/shop'); }}><span className="market-brand-mark">f.</span><strong>fieldnotes</strong></a></header><main className="checkout-empty"><h1>Your cart is empty</h1><p>Add a few things to your cart before checking out.</p><button className="checkout-place-order" type="button" onClick={() => onNavigate('/shop')}>Continue shopping</button></main></div>;

  const line = (name) => errors[name]?.[0];
  return (
    <div className="marketplace market-checkout">
      <header className="market-header"><a className="market-brand" href="/shop" onClick={(event) => { event.preventDefault(); onNavigate('/shop'); }}><span className="market-brand-mark">f.</span><strong>fieldnotes</strong></a><div className="checkout-title">Secure checkout <span aria-hidden="true">âŒ‘</span></div><button className="market-admin" type="button" onClick={() => onNavigate('/account')}><span>Have an account?</span><strong>Sign in / Orders</strong></button><button className="market-admin checkout-return" type="button" onClick={() => onNavigate('/shop')}><span>Need to change your cart?</span><strong>Return to shop</strong></button></header>
      <main className="checkout-layout">
        <div className="checkout-main"><p className="checkout-step">CHECKOUT <span>Â·</span> DELIVERY &amp; PAYMENT</p><h1>Where should we send it?</h1><p className="checkout-lead">Enter your delivery details. Payment is due to the courier when your order arrives.</p>
          {message && <div className="banner banner-error" role="alert">{message}</div>}
          {line('items') && <div className="banner banner-error" role="alert">{line('items')}</div>}
          <form className="checkout-form" onSubmit={submit}>
            <section className="checkout-section"><h2>Contact details</h2><div className="checkout-fields"><label className="checkout-field wide"><span>Full name</span><input name="customer_name" autoComplete="name" value={values.customer_name} onChange={update} required maxLength="255" />{line('customer_name') && <small>{line('customer_name')}</small>}</label><label className="checkout-field"><span>Email address</span><input name="email" type="email" autoComplete="email" value={values.email} onChange={update} required />{line('email') && <small>{line('email')}</small>}</label><label className="checkout-field"><span>Phone number</span><input name="phone" type="tel" autoComplete="tel" value={values.phone} onChange={update} required />{line('phone') && <small>{line('phone')}</small>}</label></div></section>
            <section className="checkout-section"><h2>Delivery address</h2>{savedAddresses.length > 0 && <label className="checkout-field saved-address-select"><span>Choose a saved address</span><select value={selectedAddressId} onChange={selectAddress}><option value="">Enter a different address</option>{savedAddresses.map((address) => <option value={address.id} key={address.id}>{address.label} Â· {address.address_line1}, {address.city}</option>)}</select></label>}<div className="checkout-fields"><label className="checkout-field wide"><span>Street address</span><input name="address_line1" autoComplete="address-line1" value={values.address_line1} onChange={update} required />{line('address_line1') && <small>{line('address_line1')}</small>}</label><label className="checkout-field wide"><span>Apartment, suite, etc. <em>Optional</em></span><input name="address_line2" autoComplete="address-line2" value={values.address_line2} onChange={update} />{line('address_line2') && <small>{line('address_line2')}</small>}</label><label className="checkout-field"><span>City</span><input name="city" autoComplete="address-level2" value={values.city} onChange={update} required />{line('city') && <small>{line('city')}</small>}</label><label className="checkout-field"><span>State / region</span><input name="region" autoComplete="address-level1" value={values.region} onChange={update} required />{line('region') && <small>{line('region')}</small>}</label><label className="checkout-field"><span>ZIP / postal code</span><input name="postal_code" autoComplete="postal-code" value={values.postal_code} onChange={update} required />{line('postal_code') && <small>{line('postal_code')}</small>}</label><label className="checkout-field"><span>Country code</span><input name="country" autoComplete="country" value={values.country} onChange={(event) => setValues((current) => ({ ...current, country: event.target.value.toUpperCase() }))} required minLength="2" maxLength="2" />{line('country') && <small>{line('country')}</small>}</label></div>{window.localStorage.getItem('fieldnotes-customer-token') && <label className="checkout-consent save-checkout-address"><input type="checkbox" name="save_address" checked={values.save_address} onChange={update} /><span>Save this address to my account</span></label>}</section>
            <section className="checkout-section"><h2>Payment</h2><div className="checkout-payment"><span className="checkout-cod-icon" aria-hidden="true">$</span><span><strong>Cash on delivery</strong><small>Pay in cash when your order arrives.</small></span><span className="checkout-radio" aria-label="Selected" /></div></section>
            <label className="checkout-consent"><input type="checkbox" name="accept_policy" checked={values.accept_policy} onChange={update} required /><span>I confirm that my delivery details are correct and agree to place this order.</span></label>{line('accept_policy') && <small className="checkout-error">{line('accept_policy')}</small>}
            <button className="checkout-place-order" type="submit" disabled={submitting || cartSyncing || window.localStorage.getItem('fieldnotes-cart-merge-pending') === '1'}>{submitting ? 'Placing your orderâ€¦' : `Place order Â· ${money.format(subtotal)}`}</button><p className="checkout-security">Your payment details are not collected. This local MVP supports cash on delivery.</p>
          </form>
        </div>
        <aside className="checkout-summary"><h2>Order summary <span>{cart.reduce((sum, item) => sum + item.quantity, 0)} items</span></h2><div className="checkout-lines">{cart.map((item) => <div className="checkout-line" key={item.id}>{item.image_url ? <img src={item.image_url} alt="" /> : <span className="checkout-thumb">{item.name.slice(0, 1)}</span>}<span><strong>{item.name}</strong><small>Qty {item.quantity}</small></span><b>{money.format(Number(item.price) * item.quantity)}</b></div>)}</div><div className="checkout-coupon"><label htmlFor="checkout-coupon-code">Discount code</label><div><input id="checkout-coupon-code" value={couponCode} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); setAppliedCoupon(null); setCouponMessage(''); }} maxLength={40} placeholder="Enter code" /><button type="button" onClick={applyCoupon} disabled={checkingCoupon || !couponCode.trim()}>{checkingCoupon ? 'Checking...' : appliedCoupon ? 'Applied' : 'Apply'}</button></div>{couponMessage && <small className={appliedCoupon ? 'coupon-success' : 'coupon-error'} role="status">{couponMessage}</small>}</div><div className="checkout-totals"><p><span>Subtotal</span><b>{money.format(subtotal)}</b></p>{appliedCoupon && <p className="coupon-total"><span>Discount ({appliedCoupon.code})</span><b>âˆ’{money.format(discount)}</b></p>}<p><span>Shipping</span><b>FREE</b></p><p><span>Tax</span><b>$0.00</b></p><p className="checkout-grand-total"><span>Due on delivery</span><b>{money.format(Math.max(0, subtotal - discount))}</b></p></div><p className="checkout-recheck">Local checkout uses free shipping and no tax. The final total, coupon validity, and available stock are confirmed securely when your order is placed.</p></aside>
      </main>
    </div>
  );
}

export function OrderConfirmation({ orderNumber, accessToken, onNavigate }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState('');

  async function cancelOrder() {
    if (!window.confirm('Cancel this order? Any reserved items will be returned to stock.')) return;
    setCancelling(true);
    setCancelMessage('');
    try {
      setOrder(await cancelPrivateOrder(orderNumber, accessToken));
    } catch (requestError) {
      setCancelMessage(requestError.response?.data?.errors?.order?.[0] || requestError.response?.data?.message || 'This order could not be cancelled.');
    } finally {
      setCancelling(false);
    }
  }

  useEffect(() => {
    let active = true;
    getOrder(orderNumber, accessToken)
      .then((data) => { if (active) setOrder(data); })
      .catch(() => { if (active) setError('This order link is invalid or has expired.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderNumber, accessToken]);

  return <div className="marketplace market-checkout"><header className="market-header"><a className="market-brand" href="/shop" onClick={(event) => { event.preventDefault(); onNavigate('/shop'); }}><span className="market-brand-mark">f.</span><strong>fieldnotes</strong></a><span className="checkout-title">Order details</span></header><main className="confirmation-wrap">{loading ? <section className="confirmation-card"><span className="spinner" /> Loading your orderâ€¦</section> : error ? <section className="confirmation-card"><h1>Order unavailable</h1><p>{error}</p><button className="checkout-place-order" type="button" onClick={() => onNavigate('/shop')}>Back to shop</button></section> : <><section className="confirmation-success"><span aria-hidden="true">âœ“</span><div><p>{order.status === "cancelled" ? "ORDER CANCELLED" : "ORDER CONFIRMED"}</p><h1>{order.status === "cancelled" ? "Your order was cancelled." : `Thank you, ${order.customer_name.split(" ")[0]}.`}</h1><span>Weâ€™ve received your order and will prepare it shortly.</span></div></section>{cancelMessage && <div className="banner banner-error" role="alert">{cancelMessage}</div>}{order.status === "placed" && order.payment_status === "pending" && <button className="confirmation-shop" type="button" disabled={cancelling} onClick={cancelOrder}>{cancelling ? "Cancelling..." : "Cancel this order"}</button>}<div className="confirmation-columns"><section className="confirmation-card"><div className="confirmation-card-title"><div><p className="checkout-step">ORDER NUMBER</p><h2>{order.order_number}</h2></div><span className="order-status">{order.status}</span></div><h3>Items</h3>{order.items.map((item, index) => <div className="confirmation-item" key={`${item.product_name}-${index}`}><span><strong>{item.product_name}</strong><small>Qty {item.quantity} Ã— {money.format(Number(item.unit_price))}</small></span><b>{money.format(Number(item.line_total))}</b></div>)}{order.coupon_code && <div className="confirmation-total"><span>Discount ({order.coupon_code})</span><strong>-{money.format(Number(order.discount_total))}</strong></div>}<div className="confirmation-total"><span>Total due on delivery</span><strong>{money.format(Number(order.grand_total))}</strong></div></section><aside className="confirmation-card"><h3>Delivery &amp; payment</h3><p><strong>{order.customer_name}</strong><br />{order.address.address_line1}{order.address.address_line2 ? `, ${order.address.address_line2}` : ''}<br />{order.address.city}, {order.address.region} {order.address.postal_code}<br />{order.address.country}</p><p><strong>Cash on delivery</strong><br />Payment due when your order arrives.<br />Payment status: {order.payment_status}{Number(order.refunded_total) > 0 && <><br />Refunded: {money.format(Number(order.refunded_total))}</>}</p><p>Order placed {new Date(order.created_at).toLocaleString()}</p><OrderTimeline events={order.status_history} label={`Status history for ${order.order_number}`} /></aside></div><button className="confirmation-shop" type="button" onClick={() => onNavigate('/shop')}>Continue shopping</button></>}</main></div>;
}
