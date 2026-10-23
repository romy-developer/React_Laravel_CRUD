export default function ProductRating({ product }) {
  const count = Number(product?.reviews_count || 0);
  if (!count) return <span className="product-rating product-rating-empty">No reviews yet</span>;

  const average = Number(product.reviews_avg_rating || 0);
  const fill = `${Math.max(0, Math.min(100, average * 20))}%`;
  return <span className="product-rating" aria-label={`${average.toFixed(1)} out of 5 from ${count} reviews`}>
    <span className="product-rating-stars" style={{ '--rating-fill': fill }} aria-hidden="true"><span>★★★★★</span><b>★★★★★</b></span>
    <span className="product-rating-value">{average.toFixed(1)}</span>
    <span className="product-rating-count">({count})</span>
  </span>;
}
