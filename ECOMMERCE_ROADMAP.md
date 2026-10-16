# Mini Ecommerce Project Roadmap

## Product direction

Grow the current React + Laravel + MySQL inventory app into a single-store ecommerce site. Shoppers can browse a catalogue, manage a cart, check out, and track orders. Store staff can manage products, inventory, customers, and fulfillment from an admin area.

This roadmap targets a polished, production-minded MVP. A multi-vendor marketplace, seller payouts, multiple warehouses, and Amazon-scale distributed infrastructure are separate products and are intentionally outside the first release.

## User roles

- **Guest shopper:** browse/search products, manage a session cart, and check out as a guest.
- **Customer:** manage profile and addresses, check out, view order history, and request cancellation while eligible.
- **Administrator:** manage catalogue, stock, promotions, customers, and all orders.
- **Fulfillment staff:** view and update assigned order fulfillment states without access to application settings or payment secrets.

Authorization must be enforced by Laravel policies and middleware on every protected endpoint. Hiding an action in React is not an authorization control.

## Shopper experience

### Storefront and catalogue

- Responsive storefront with a branded home page, featured products, categories, and promotions.
- Product listing with pagination, search, category filters, price range, availability, sort order, and clear empty/loading/error states.
- Product detail with image gallery, description, price, stock status, category, condition, SKU, and related products.
- Accessible layouts, keyboard support, mobile navigation, meaningful image alt text, and clear form errors.
- Product metadata and friendly URLs for sharing and search engines.

### Cart and checkout

- Cart available to guests and signed-in users; merge guest cart after login.
- Change quantities, remove lines, see item totals, shipping estimate, discount, tax, and grand total.
- Validate current price and stock on the server at checkout. Never trust totals sent by the browser.
- Guest checkout and saved customer addresses.
- Validate delivery address, shipping method, contact details, and required consent before order placement.
- Present a final order summary before confirmation.

### Orders and customer account

- Order confirmation page and email with a human-readable order number.
- Customer order list and order detail with line item snapshots, totals, payment state, and shipping state.
- Order status timeline: pending payment, placed, processing, packed, shipped, delivered, cancelled, refunded.
- Cancellation and refund eligibility checked against the current order and payment state.
- Profile and address management with validation and a default address.

## Admin experience

- Dashboard for sales, order counts, low-stock products, and recent activity.
- Product CRUD with categories, SKU, price, compare-at price, descriptions, image gallery, publish state, and inventory controls.
- Category CRUD with hierarchy only if the catalogue needs it.
- Inventory adjustments recorded as auditable stock movements with reason, actor, quantity delta, and timestamp.
- Order search/filter by date, status, customer, and order number; fulfill, cancel, and refund actions guarded by permissions.
- Customer lookup and promotion/coupon management.
- Staff role management, audit history, and safe application settings.
- Confirm destructive actions and show success/error feedback; do not expose secrets in the UI.

## Domain model

Recommended core tables and relationships:

- `users`, `roles`/permissions (or a small explicit role enum for the initial release), `addresses`
- `categories`, `products`, `product_images`
- `carts`, `cart_items` (or guest cart tokens plus customer cart ownership)
- `orders`, `order_items`, `order_addresses`, `order_status_history`
- `payments`, `refunds`, `shipments`
- `inventory_movements`
- `coupons`, `coupon_redemptions`

Order items must snapshot product name, SKU, unit price, quantity, and applicable tax at purchase time. Later catalogue edits must not rewrite historical orders. Store monetary amounts as integer minor units or fixed-precision decimals with an explicit currency; never use floating-point arithmetic for totals. Keep stock updates transactional and prevent two checkouts from overselling the same last unit.

## API and application boundaries

- Keep React as the storefront/admin client and Laravel as the authoritative API and business-rule layer.
- Group endpoints by domain and version public API paths (for example, `/api/v1/products`, `/api/v1/cart`, `/api/v1/orders`).
- Use Form Requests for validation, Policies for authorization, Resources for response shape, and Services/Actions for checkout and payment workflows.
- Paginate product and order lists. Return consistent error shapes and validation messages.
- Add idempotency protection to order creation and payment operations so retries cannot create duplicate charges or orders.
- Keep payment-provider secrets and webhook verification on the server. Verify webhook signatures and make webhook handlers idempotent.

## Production requirements

### Security and privacy

- Authentication with secure session/token handling, password reset, email verification, and optional MFA for administrators.
- Role-based authorization, request validation, CSRF/CORS configuration, rate limits, secure headers, and least-privilege database credentials.
- Validate uploaded image type, size, and content; generate safe names; store outside the application code directory or use object storage in production.
- Never store raw card details. Use a PCI-compliant hosted checkout or tokenized provider flow.
- Keep PII collection minimal, define retention/deletion rules, and avoid logging passwords, tokens, addresses, or payment data.
- Manage secrets through environment/secret storage, force HTTPS in production, and keep debug output disabled.

### Reliability and operations

- Database transactions around order placement, payment state, coupon use, and stock reservation.
- Background jobs for email, image processing, and non-blocking integrations; retries with backoff and dead-letter visibility.
- Structured logs with request/order identifiers, health checks, error reporting, and audit logs for admin actions.
- Automated database backups with a restore procedure, dependency/security updates, and a rollback plan for migrations.
- Separate local, staging, and production settings. Use production build assets and a managed process/web server rather than development servers.

### Quality gates

- Unit tests for pricing, discounts, inventory, and authorization rules.
- Feature tests for registration/login, catalogue access, cart ownership, checkout, payment webhooks, order transitions, and admin permissions.
- Frontend component and end-to-end coverage for browse → cart → checkout → confirmation and admin product/order workflows.
- CI checks for formatting, static analysis, dependency audit, tests, and production builds.
- Accessibility review and responsive checks on common phone, tablet, and desktop sizes.

## Suggested delivery phases

1. **Foundation:** finalize routes/layout, authentication, roles, API conventions, validation, and a migration strategy that preserves existing inventory data.
2. **Storefront catalogue:** public product/category pages, search, filters, product images, and admin product publishing.
3. **Cart:** guest and customer carts, quantity updates, server-side price/stock refresh, and cart merge on sign-in.
4. **Checkout and orders:** addresses, shipping options, tax/discount calculation, order snapshots, stock reservation, confirmation page, and email.
5. **Payments and fulfillment:** hosted sandbox payment integration, verified webhooks, COD if desired, shipment tracking, refunds, and staff workflows.
6. **Production hardening:** security review, automated coverage, observability, backups/restore drill, staging deployment, and production deployment runbook.

## MVP defaults

Until store-specific choices are supplied, use a single store, one currency, guest checkout plus optional customer accounts, a flat/free shipping rule, and cash on delivery in local development. Payment-provider integration should begin in sandbox mode and must not accept live credentials until deployment and security settings are reviewed.

## Current project starting point

The repository already has a Laravel API, React/Vite frontend, MySQL configuration, product CRUD, product categories/condition/image support, a dashboard, and separate product listing/add/edit/detail routes. It does not yet have shopper accounts, a storefront, carts, checkout, order management, payments, shipping, or production deployment configuration. Keep the current product records and migrate forward; do not reset or drop the existing database as part of the ecommerce conversion.
