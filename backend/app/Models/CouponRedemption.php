<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CouponRedemption extends Model
{
    protected $fillable = ['coupon_id', 'order_id', 'user_id', 'email', 'discount_total'];
}
