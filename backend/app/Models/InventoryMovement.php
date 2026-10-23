<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryMovement extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'product_id', 'product_reference_id', 'product_name', 'product_sku', 'order_id', 'actor_user_id', 'actor_type',
        'quantity_delta', 'reason', 'note', 'created_at',
    ];

    protected function casts(): array
    {
        return ['created_at' => 'datetime', 'quantity_delta' => 'integer'];
    }

    protected static function booted(): void
    {
        static::creating(function (InventoryMovement $movement) {
            if (! $movement->product_reference_id && $movement->product_id) {
                $movement->product_reference_id = $movement->product_id;
            }
        });
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
