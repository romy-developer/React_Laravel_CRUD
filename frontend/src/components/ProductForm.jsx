import { useEffect, useState } from 'react';

const emptyProduct = {
  name: '',
  description: '',
  price: '',
  quantity: '',
};

function fieldError(errors, field) {
  return errors[field]?.[0];
}

export default function ProductForm({ product, onSubmit, onCancel, saving, errors }) {
  const [values, setValues] = useState(emptyProduct);

  useEffect(() => {
    setValues(product ? {
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      quantity: String(product.quantity),
    } : emptyProduct);
  }, [product]);

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const saved = await onSubmit(values);

    if (saved && !product) {
      setValues(emptyProduct);
    }
  }

  return (
    <section className="panel form-panel" aria-labelledby="form-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{product ? 'Make changes' : 'Inventory entry'}</p>
          <h2 id="form-heading">{product ? 'Edit product' : 'Add a product'}</h2>
        </div>
        {product && <span className="edit-mark">Editing #{product.id}</span>}
      </div>

      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>Product name</span>
          <input
            autoComplete="off"
            name="name"
            value={values.name}
            onChange={updateField}
            maxLength="255"
            required
            aria-invalid={Boolean(fieldError(errors, 'name'))}
            aria-describedby={fieldError(errors, 'name') ? 'name-error' : undefined}
          />
          {fieldError(errors, 'name') && <small className="field-error" id="name-error">{fieldError(errors, 'name')}</small>}
        </label>

        <label className="field">
          <span>Description <span className="optional">Optional</span></span>
          <textarea
            name="description"
            value={values.description}
            onChange={updateField}
            rows="3"
            aria-invalid={Boolean(fieldError(errors, 'description'))}
            aria-describedby={fieldError(errors, 'description') ? 'description-error' : undefined}
          />
          {fieldError(errors, 'description') && <small className="field-error" id="description-error">{fieldError(errors, 'description')}</small>}
        </label>

        <div className="field-pair">
          <label className="field">
            <span>Price</span>
            <div className="input-prefix">
              <span aria-hidden="true">$</span>
              <input
                type="number"
                name="price"
                value={values.price}
                onChange={updateField}
                min="0"
                step="0.01"
                required
                aria-invalid={Boolean(fieldError(errors, 'price'))}
                aria-describedby={fieldError(errors, 'price') ? 'price-error' : undefined}
              />
            </div>
            {fieldError(errors, 'price') && <small className="field-error" id="price-error">{fieldError(errors, 'price')}</small>}
          </label>
          <label className="field">
            <span>Quantity</span>
            <input
              type="number"
              name="quantity"
              value={values.quantity}
              onChange={updateField}
              min="0"
              step="1"
              required
              aria-invalid={Boolean(fieldError(errors, 'quantity'))}
              aria-describedby={fieldError(errors, 'quantity') ? 'quantity-error' : undefined}
            />
            {fieldError(errors, 'quantity') && <small className="field-error" id="quantity-error">{fieldError(errors, 'quantity')}</small>}
          </label>
        </div>

        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : product ? 'Save changes' : 'Add product'}
          </button>
          {product && <button className="button button-quiet" type="button" onClick={onCancel} disabled={saving}>Cancel</button>}
        </div>
      </form>
    </section>
  );
}