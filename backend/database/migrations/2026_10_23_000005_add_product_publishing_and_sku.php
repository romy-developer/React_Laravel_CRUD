<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('sku', 64)->nullable()->unique()->after('name');
            $table->decimal('compare_at_price', 12, 2)->nullable()->after('price');
            $table->boolean('is_published')->default(true)->index()->after('quantity');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->string('product_sku', 64)->nullable()->after('product_name');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('product_sku');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['sku']);
            $table->dropIndex(['is_published']);
            $table->dropColumn(['sku', 'compare_at_price', 'is_published']);
        });
    }
};
