<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('description', 160)->nullable();
            $table->string('discount_type', 16);
            $table->decimal('discount_value', 10, 2);
            $table->decimal('minimum_subtotal', 12, 2)->default(0);
            $table->unsignedInteger('max_redemptions')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();
            $table->index(['is_active', 'starts_at', 'ends_at']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('coupon_code', 40)->nullable()->after('subtotal');
            $table->decimal('discount_total', 12, 2)->default(0)->after('coupon_code');
        });

        Schema::create('coupon_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coupon_id')->constrained()->restrictOnDelete();
            $table->foreignId('order_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('email');
            $table->decimal('discount_total', 12, 2);
            $table->timestamps();
            $table->index(['coupon_id', 'email']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coupon_redemptions');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['coupon_code', 'discount_total']);
        });
        Schema::dropIfExists('coupons');
    }
};
