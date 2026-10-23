<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Order extends Model
{
    protected $fillable = [
        'user_id', 'assigned_to_user_id', 'order_number', 'idempotency_key', 'access_token_hash', 'customer_name', 'email', 'phone',
        'address_line1', 'address_line2', 'city', 'region', 'postal_code', 'country',
        'subtotal', 'coupon_code', 'discount_total', 'shipping_total', 'tax_total', 'grand_total', 'currency', 'payment_method',
        'payment_status', 'status', 'shipping_carrier', 'tracking_number', 'shipped_at',
    ];

    protected function casts(): array
    {
        return ['shipped_at' => 'datetime'];
    }

    protected $hidden = ['access_token_hash', 'idempotency_key'];

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class)->orderBy('created_at')->orderBy('id');
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function assignmentHistory(): HasMany
    {
        return $this->hasMany(OrderAssignmentHistory::class)->with(['assignee', 'assigner'])->latest('id');
    }
}
