<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('product_reference_id')->index();
            $table->string('product_name');
            $table->string('product_sku', 64)->nullable();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_type', 24)->default('system');
            $table->integer('quantity_delta');
            $table->string('reason', 40);
            $table->string('note', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['product_id', 'created_at']);
            $table->index(['order_id', 'created_at']);
        });

        DB::table('products')->select(['id', 'name', 'sku', 'quantity', 'created_at'])->orderBy('id')->chunkById(500, function ($products) {
            DB::table('inventory_movements')->insert($products->map(fn ($product) => [
                'product_id' => $product->id,
                'product_reference_id' => $product->id,
                'product_name' => $product->name,
                'product_sku' => $product->sku,
                'order_id' => null,
                'actor_user_id' => null,
                'actor_type' => 'system',
                'quantity_delta' => (int) $product->quantity,
                'reason' => 'opening_balance',
                'note' => 'Initial stock snapshot; earlier stock movements were not recorded.',
                'created_at' => now(),
            ])->all());
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_movements');
    }
};
