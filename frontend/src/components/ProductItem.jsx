export default function ProductItem({ product, onEdit, onDelete, deleting }) {
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(product.price));

  return (
    <tr>
      <th scope="row" className="product-name">{product.name}</th>
      <td className="description-cell">{product.description || <span className="muted">No description</span>}</td>
      <td className="numeric-cell">{formattedPrice}</td>
      <td className="numeric-cell">{product.quantity.toLocaleString()}</td>
      <td className="actions-cell">
        <button className="table-action" type="button" onClick={() => onEdit(product)} aria-label={`Edit ${product.name}`}>
          Edit
        </button>
        <button className="table-action table-action-danger" type="button" onClick={() => onDelete(product)} disabled={deleting} aria-label={`Delete ${product.name}`}>
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </td>
    </tr>
  );
}