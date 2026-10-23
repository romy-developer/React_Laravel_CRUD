<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Coupon extends Model
{
    protected $fillable = [
        'code', 'description', 'discount_type', 'discount_value', 'minimum_subtotal',
        'max_redemptions', 'is_active', 'starts_at', 'ends_at',
        'is_promoted',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'is_promoted' => 'boolean', 'starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(CouponRedemption::class);
    }
}
