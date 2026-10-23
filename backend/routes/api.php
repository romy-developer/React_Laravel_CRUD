<?php

use App\Http\Controllers\ProductController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AdminOrderController;
use App\Http\Controllers\CouponController;
use App\Http\Controllers\CustomerCartController;
use App\Http\Controllers\InventoryMovementController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\AdminCustomerController;
use App\Http\Controllers\AdminStaffController;
use App\Http\Controllers\AdminAuditController;
use App\Http\Controllers\StoreProductReviewController;
use Illuminate\Support\Facades\Route;

Route::get('store/products', [ProductController::class, 'storefront']);
Route::get('store/featured', [ProductController::class, 'featured']);
Route::get('store/promotions', [CouponController::class, 'storefrontPromotions']);
Route::get('store/products/{productId}', [ProductController::class, 'storefrontShow']);
Route::get('store/products/{productId}/reviews', [StoreProductReviewController::class, 'index']);
Route::post('store/coupons/validate', [CouponController::class, 'validateForStore'])->middleware('throttle:20,1');
Route::post('checkout', [CheckoutController::class, 'store'])->middleware(['auth.optional:optional', 'throttle:10,1']);
Route::get('orders/{orderNumber}', [CheckoutController::class, 'show'])->middleware('throttle:30,1');
Route::post('orders/{orderNumber}/cancel', [CheckoutController::class, 'cancel'])->middleware('throttle:10,1');
Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('auth/password/forgot', [PasswordResetController::class, 'requestLink'])->middleware('throttle:5,1');
Route::post('auth/password/reset', [PasswordResetController::class, 'reset'])->middleware('throttle:10,1');
Route::get('auth/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
    ->middleware(['signed', 'throttle:10,1'])->name('verification.verify');

Route::middleware('auth.token')->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);

    Route::middleware('role:admin')->group(function () {
        Route::apiResource('products', ProductController::class);
        Route::get('admin/products/{product}/inventory-movements', [InventoryMovementController::class, 'index']);
        Route::get('admin/coupons', [CouponController::class, 'index']);
        Route::post('admin/coupons', [CouponController::class, 'store']);
        Route::put('admin/coupons/{coupon}', [CouponController::class, 'update']);
        Route::delete('admin/coupons/{coupon}', [CouponController::class, 'destroy']);
        Route::get('admin/dashboard', [AdminOrderController::class, 'dashboard']);
        Route::post('admin/orders/{orderNumber}/refund', [AdminOrderController::class, 'refund'])->middleware('throttle:10,1');
        Route::get('admin/customers', [AdminCustomerController::class, 'index']);
        Route::get('admin/customers/{customerId}', [AdminCustomerController::class, 'show']);
        Route::get('admin/staff', [AdminStaffController::class, 'index']);
        Route::patch('admin/staff/{userId}', [AdminStaffController::class, 'update']);
        Route::get('admin/audit-logs', [AdminAuditController::class, 'index']);
    });

    Route::middleware('role:admin,fulfillment')->group(function () {
        Route::get('admin/orders', [AdminOrderController::class, 'index']);
        Route::get('admin/orders/{orderNumber}', [AdminOrderController::class, 'show']);
        Route::patch('admin/orders/{orderNumber}', [AdminOrderController::class, 'update']);
        Route::get('admin/fulfillment-staff', [AdminOrderController::class, 'fulfillmentStaff'])->middleware('role:admin');
        Route::patch('admin/orders/{orderNumber}/assignment', [AdminOrderController::class, 'assign'])->middleware('role:admin');
    });

    Route::middleware('role:customer')->prefix('account')->group(function () {
        Route::post('email/verification-notification', [EmailVerificationController::class, 'resend'])->middleware('throttle:5,1');
        Route::get('cart', [CustomerCartController::class, 'show']);
        Route::put('cart', [CustomerCartController::class, 'sync']);
        Route::get('profile', [\App\Http\Controllers\CustomerAccountController::class, 'profile']);
        Route::put('profile', [\App\Http\Controllers\CustomerAccountController::class, 'updateProfile']);
        Route::get('addresses', [\App\Http\Controllers\CustomerAccountController::class, 'addresses']);
        Route::post('addresses', [\App\Http\Controllers\CustomerAccountController::class, 'storeAddress']);
        Route::put('addresses/{addressId}', [\App\Http\Controllers\CustomerAccountController::class, 'updateAddress']);
        Route::delete('addresses/{addressId}', [\App\Http\Controllers\CustomerAccountController::class, 'destroyAddress']);
        Route::get('orders', [\App\Http\Controllers\CustomerAccountController::class, 'orders']);
        Route::get('orders/{orderNumber}', [\App\Http\Controllers\CustomerAccountController::class, 'showOrder']);
        Route::post('orders/{orderNumber}/cancel', [\App\Http\Controllers\CustomerAccountController::class, 'cancelOrder']);
        Route::get('products/{productId}/review', [StoreProductReviewController::class, 'mine']);
        Route::post('products/{productId}/review', [StoreProductReviewController::class, 'store'])->middleware('throttle:5,1');
    });
});
