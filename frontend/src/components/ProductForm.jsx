import { useEffect, useRef, useState } from 'react';

const emptyProduct = {
  name: '',
  category: 'Other',
  condition: 'New',
  description: '',
  price: '',
  quantity: '',
  image: null,
  remove_image: false,
};

function fieldError(errors, field) {
  return errors[field]?.[0];
}

export default function ProductForm({ product, onSubmit, onCancel, saving, errors }) {
  const [values, setValues] = useState(emptyProduct);
  const [imagePreview, setImagePreview] = useState('');
  const previewObjectUrl = useRef('');

  useEffect(() => {
    setValues(product ? {
      name: product.name,
      category: product.category || 'Other',
      condition: product.condition || 'New',
      description: product.description || '',
      price: String(product.price),
      quantity: String(product.quantity),
      image: null,
      remove_image: false,
    } : emptyProduct);
    if (previewObjectUrl.current) {
      URL.revokeObjectURL(previewObjectUrl.current);
      previewObjectUrl.current = '';
    }
    setImagePreview(product?.image_url || '');
  }, [product]);

  useEffect(() => () => {
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
  }, []);

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function updateImage(event) {
    const file = event.target.files?.[0] || null;
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
    previewObjectUrl.current = file ? URL.createObjectURL(file) : '';
    setImagePreview(previewObjectUrl.current || (values.remove_image ? '' : product?.image_url || ''));
    setValues((current) => ({ ...current, image: file, remove_image: false }));
  }

  function removeImage() {
    if (previewObjectUrl.current) {
      URL.revokeObjectURL(previewObjectUrl.current);
      previewObjectUrl.current = '';
    }
    setImagePreview('');
    setValues((current) => ({ ...current, image: null, remove_image: Boolean(product?.image_url) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const saved = await onSubmit(values);

    if (saved && !product) {
      setValues(emptyProduct);
      setImagePreview('');
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

      <form onSubmit={handleSubmit} encType="multipart/form-data">
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
          <span>Category</span>
          <select name="category" value={values.category} onChange={updateField} required aria-invalid={Boolean(fieldError(errors, 'category'))} aria-describedby={fieldError(errors, 'category') ? 'category-error' : undefined}>
            <option>Electronics</option>
            <option>Clothing</option>
            <option>Home &amp; Kitchen</option>
            <option>Books</option>
            <option>Other</option>
          </select>
          {fieldError(errors, 'category') && <small className="field-error" id="category-error">{fieldError(errors, 'category')}</small>}
        </label>

        <fieldset className="field radio-field" aria-describedby={fieldError(errors, 'condition') ? 'condition-error' : undefined}>
          <legend>Condition</legend>
          <div className="radio-options">
            {['New', 'Used', 'Refurbished'].map((condition) => (
              <label className="radio-option" key={condition}>
                <input type="radio" name="condition" value={condition} checked={values.condition === condition} onChange={updateField} />
                <span>{condition}</span>
              </label>
            ))}
          </div>
          {fieldError(errors, 'condition') && <small className="field-error" id="condition-error">{fieldError(errors, 'condition')}</small>}
        </fieldset>

        <div className="field image-field">
          <span>Product image <span className="optional">Optional · JPG, PNG or WebP, up to 5 MB</span></span>
          {imagePreview && <img className="image-preview" src={imagePreview} alt="Product preview" />}
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp" onChange={updateImage} />
          {imagePreview && <button className="table-action table-action-danger image-remove" type="button" onClick={removeImage}>Remove image</button>}
          {fieldError(errors, 'image') && <small className="field-error">{fieldError(errors, 'image')}</small>}
        </div>

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
