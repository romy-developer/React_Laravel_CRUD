import { useEffect, useState } from 'react';
import { getMyProductReview, getProductReviews, saveProductReview } from '../services/productService.js';

const emptyReview = { rating: '5', title: '', body: '' };

export default function ProductReviews({ productId, onAccount }) {
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState(emptyReview);
  const [hasReview, setHasReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isCustomer = Boolean(window.localStorage.getItem('fieldnotes-customer-token'));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getProductReviews(productId, page)
      .then((data) => { if (active) setResult(data); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Reviews could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, page, refresh]);

  useEffect(() => {
    let active = true;
    if (!isCustomer) { setHasReview(false); setForm(emptyReview); return () => { active = false; }; }
    getMyProductReview(productId)
      .then((review) => {
        if (!active) return;
        setHasReview(Boolean(review));
        setForm(review ? { rating: String(review.rating), title: review.title, body: review.body } : emptyReview);
      })
      .catch(() => { if (active) setHasReview(false); });
    return () => { active = false; };
  }, [productId, isCustomer, refresh]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveProductReview(productId, { ...form, rating: Number(form.rating) });
      setForm(emptyReview);
      setPage(1);
      setRefresh((current) => current + 1);
      setNotice('Your verified-purchase review has been saved.');
    } catch (requestError) {
      const validation = requestError.response?.data?.errors || {};
      setError(validation.review?.[0] || validation.rating?.[0] || validation.title?.[0] || validation.body?.[0] || requestError.response?.data?.message || 'Your review could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const summary = result?.summary;
  const reviewPage = result?.data;

  return <section className="product-reviews" aria-labelledby="product-reviews-title">
    <div className="product-reviews-heading"><div><p className="eyebrow">SHOPPER FEEDBACK</p><h2 id="product-reviews-title">Customer reviews</h2></div>{summary && <div className="review-overall"><strong>{summary.review_count ? Number(summary.average_rating).toFixed(1) : '—'}</strong><span>{summary.review_count ? 'out of 5' : 'No ratings yet'}</span><small>{summary.review_count} verified {summary.review_count === 1 ? 'review' : 'reviews'}</small></div>}</div>
    {summary?.review_count > 0 && <div className="review-summary-bars" aria-label="Rating breakdown">{[5, 4, 3, 2, 1].map((rating) => { const count = Number(summary.rating_breakdown?.[rating] || 0); const width = summary.review_count ? `${(count / summary.review_count) * 100}%` : '0%'; return <div className="review-summary-row" key={rating}><span>{rating} star</span><span className="review-summary-track"><span style={{ width }} /></span><span>{count}</span></div>; })}</div>}
    {error && !isCustomer && <div className="banner banner-error" role="alert">{error}</div>}

    {isCustomer ? <form className="product-review-form" onSubmit={submit}>
      <h3>{hasReview ? 'Update your review' : 'Write a review'}</h3><p>Reviews are limited to customers with a delivered order for this product. You can update your review later.</p>
      {error && <div className="banner banner-error" role="alert">{error}</div>}{notice && <div className="banner banner-success" role="status">{notice}</div>}
      <label>Rating<select value={form.rating} onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))}><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — It's okay</option><option value="2">2 — Could be better</option><option value="1">1 — Not for me</option></select></label>
      <label>Headline<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required minLength="3" maxLength="120" placeholder="What should shoppers know?" /></label>
      <label>Your review<textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} required minLength="10" maxLength="2000" rows="4" placeholder="Share details about quality, fit, or how you use it." /></label>
      <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving review…' : hasReview ? 'Update review' : 'Submit review'}</button>
    </form> : <div className="review-signin"><span>Purchased this item? Sign in with the account used for a delivered order to write a verified review.</span><button type="button" onClick={onAccount}>Sign in</button></div>}

    <div className="product-review-list" aria-live="polite">
      {loading ? <p className="review-list-state" role="status">Loading reviews…</p> : reviewPage?.data?.length ? reviewPage.data.map((review) => <article className="product-review" key={review.id}><div className="product-review-meta"><span className="review-stars-static" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span><span className="verified-buyer">Verified purchase</span><time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString()}</time></div><h3>{review.title}</h3><p className="review-author">{review.customer_name}</p><p className="review-body">{review.body}</p></article>) : <p className="review-list-state">No customer reviews yet. Be the first verified customer to share feedback.</p>}
    </div>
    {!loading && reviewPage?.last_page > 1 && <nav className="store-pagination" aria-label="Review pages"><button className="button button-quiet" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {reviewPage.current_page} of {reviewPage.last_page}</span><button className="button button-quiet" type="button" disabled={page >= reviewPage.last_page} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}
  </section>;
}
