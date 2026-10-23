# Fieldnotes Store

> Ecommerce expansion scope and production delivery plan: [ECOMMERCE_ROADMAP.md](ECOMMERCE_ROADMAP.md).

A single-store ecommerce MVP built with React + Vite, a Laravel API, and MySQL. The customer site supports catalogue search, shareable product detail pages, guest carts, account-synced carts with guest-cart merging, saved delivery addresses, timestamped order status history, shipment tracking details, coupon codes, confirmation and status emails, and cash-on-delivery checkout. Store managers can prepare unpublished products, maintain SKUs and compare-at pricing, review per-product stock movement history, create and disable promotions, review order and revenue summaries, and fulfill orders with carrier and tracking information. Admins assign fulfillment orders; staff see and update only their assigned queue. Product, promotion, customer, and refund management require an administrator account.

## Project Structure

```text
crud/
├── backend/                 Laravel application
│   ├── app/Models/Product.php
│   ├── app/Http/Controllers/ProductController.php
│   ├── config/cors.php
│   ├── database/migrations/*_create_products_table.php
│   ├── routes/api.php
│   └── .env
├── frontend/                React application
│   ├── src/components/
│   ├── src/services/
│   ├── src/App.jsx
│   ├── src/main.jsx
│   ├── .env
│   └── package.json
└── README.md
```

## 1. Requirements and Laravel Version

Install XAMPP with PHP and MySQL, Composer, and Node.js/npm. The frontend uses Vite 7 and requires a current Node.js release (Node 20.19+ or 22.12+).

Composer selected Laravel 12.69.3 in this workspace because the installed PHP does not satisfy Laravel 13's PHP 8.3 requirement. Laravel 12 is the newest compatible stable version for this PHP runtime. To use Laravel 13, upgrade XAMPP/PHP to 8.3 or later and recreate/install the backend with Composer.

## 2. Create the MySQL Database

Start MySQL in the XAMPP Control Panel, then create the database with the XAMPP MySQL client:

```powershell
D:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE crud_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Alternatively, run the following in phpMyAdmin or a MySQL prompt:

```sql
CREATE DATABASE crud_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 3. Configure the Laravel Environment

`backend/.env` is configured for the requested local MySQL settings. The database section should be:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=crud_app
DB_USERNAME=root
DB_PASSWORD=
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

For a fresh checkout, copy `backend/.env.example` to `backend/.env`, update the values for your MySQL account, then run `php artisan key:generate` from `backend/`.

Password reset and email verification messages use Laravel's configured mailer. Reset links open the appropriate customer account or store-team sign-in page on `FRONTEND_URL`; verification links use a signed, expiring API URL and return shoppers to the account page after verification. The local example uses `MAIL_MAILER=log`, so these emails (including their links) are written to `backend/storage/logs/laravel.log`; configure SMTP or another mail transport before sending customer emails from a deployed store.

## 4. Migration, Model, Controller, Routes, and CORS

The `products` migration creates `id`, `name`, nullable `description`, decimal `price`, unsigned integer `quantity`, and Laravel timestamps. The `Product` model allows only the four writable product fields. `ProductController` validates input, returns JSON, uses 201 for creation, 200 for reads/updates/deletes, 422 for invalid input, and 404 when a product is missing.

The API routes are registered from `bootstrap/app.php` and defined with Laravel's `Route::apiResource`. Laravel's CORS middleware reads `config/cors.php`; `FRONTEND_URL` limits browser access to the Vite origin. Update it if Vite runs on another port. API errors are rendered as JSON even when the caller omits an `Accept` header.

Install backend dependencies if needed and apply the migration:

```powershell
cd backend
composer install
php artisan migrate
```

If `php` is not on PATH, use XAMPP's binary, for example `D:\xampp\php\php.exe artisan migrate`.

## 5. React, Axios, and Components

The React UI is in `frontend/src`. `services/api.js` is the shared Axios instance; all product HTTP calls are in `services/productService.js`. `ProductForm`, `ProductList`, and `ProductItem` provide the form, table, and row interactions. The UI includes loading/empty states, browser and server validation, success/error messages, save disabling, delete confirmation, and responsive layout.

The frontend API URL is configured in `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:8000/api
```

After changing a Vite environment variable, restart the dev server.

## 6. Run the Applications

Start the Laravel API from one terminal:

```powershell
cd backend
.\dev-server.cmd
```

Start the React app from another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Start MySQL before migrating or using the API. The backend launcher sets PHP's upload temporary directory to a writable project-local folder so image uploads don't emit a PHP startup notice.

### First-time administrator setup

From `backend/`, create an administrator account. The command prompts for a password without echoing it:

```powershell
D:\xampp\php\php.exe artisan app:make-admin admin@example.com
```

To create an order-fulfillment account with access limited to the order workspace, use `php artisan app:make-fulfillment-staff staff@example.com`. Both commands prompt for a password when creating a new account. Promoting an existing account revokes its current API tokens so it must sign in again with its new role.

Open `http://localhost:5173/login` to manage products and orders. Customer browsing is at `http://localhost:5173/shop`; customers can sign in or register at `http://localhost:5173/account` and check out as a guest or signed-in customer. The local checkout uses cash on delivery, free shipping, and no tax calculation. Prices and stock are rechecked by Laravel when an order is placed.

## 7. REST API Examples

All endpoints are under `http://localhost:8000/api`:

| Method | Path | Result |
| --- | --- | --- |
| GET | `/products` | List products |
| GET | `/products/{id}` | Read one product |
| POST | `/products` | Create a product |
| PUT | `/products/{id}` | Replace product fields |
| DELETE | `/products/{id}` | Delete a product |

Example PowerShell requests (use `curl.exe`, not the `curl` alias):

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/auth/login `
  -ContentType 'application/json' -Body '{"email":"admin@example.com","password":"YOUR_ADMIN_PASSWORD"}'
$token = $login.token

curl.exe -H "Accept: application/json" -H "Authorization: Bearer $token" http://localhost:8000/api/products

curl.exe -X POST http://localhost:8000/api/products `
  -H "Accept: application/json" -H "Authorization: Bearer $token" -H "Content-Type: application/json" `
  -d '{"name":"Notebook","category":"Books","condition":"New","description":"Grid paper, 120 pages","price":12.5,"quantity":20}'

curl.exe -X PUT http://localhost:8000/api/products/1 `
  -H "Accept: application/json" -H "Authorization: Bearer $token" -H "Content-Type: application/json" `
  -d '{"name":"Notebook","category":"Books","condition":"New","description":"Updated description","price":14,"quantity":18}'

curl.exe -X DELETE -H "Accept: application/json" -H "Authorization: Bearer $token" http://localhost:8000/api/products/1
```

The product CRUD and order management APIs require an administrator bearer token. Public catalogue and guest checkout endpoints do not use this token.

List response (`200 OK`):

```json
{
  "data": [
    {
      "id": 1,
      "name": "Notebook",
      "description": "Grid paper, 120 pages",
      "price": "12.50",
      "quantity": 20,
      "created_at": "2026-10-01T12:00:00.000000Z",
      "updated_at": "2026-10-01T12:00:00.000000Z"
    }
  ]
}
```

Create response (`201 Created`) and delete response (`200 OK`):

```json
{"message":"Product created successfully.","data":{"id":1,"name":"Notebook","description":"Grid paper, 120 pages","price":"12.50","quantity":20,"created_at":"2026-10-01T12:00:00.000000Z","updated_at":"2026-10-01T12:00:00.000000Z"}}
{"message":"Product deleted successfully."}
```

Invalid fields return `422 Unprocessable Content` with field-specific messages. A missing product returns `404 Not Found`:

```json
{
  "message": "The name field is required.",
  "errors": {
    "name": ["The name field is required."]
  }
}
```

Laravel's exact validation message text may vary by failing rule; its response always includes `message` and `errors`.

## 8. Troubleshooting

- **Unknown database `crud_app`:** start MySQL and run the database creation command before `php artisan migrate`.
- **Access denied for `root`:** set the correct `DB_USERNAME`/`DB_PASSWORD` in `backend/.env`, then run `php artisan config:clear`.
- **`could not find driver` / MySQL connection error:** enable `extension=pdo_mysql` in the active XAMPP `php.ini`, restart PHP/Apache if applicable, and verify `D:\xampp\php\php.exe -m` lists `pdo_mysql`.
- **CORS error in the browser:** set `FRONTEND_URL` to the exact frontend origin (including port), then run `php artisan config:clear` and restart Laravel.
- **API connection refused:** verify Laravel is listening on port 8000 and `frontend/.env` has `VITE_API_URL=http://localhost:8000/api`.
- **404 for every API path:** from `backend/`, run `php artisan route:list --path=api` and confirm the `api/products` routes are listed.
- **Frontend dependency/build error:** use a supported Node.js version, then run `npm install` again from `frontend/`.
