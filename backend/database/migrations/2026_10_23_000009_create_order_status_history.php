<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32);
            $table->string('actor_type', 24)->default('system');
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name')->nullable();
            $table->string('note', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['order_id', 'created_at']);
        });

        DB::table('orders')->select(['id', 'status', 'created_at'])->orderBy('id')->chunkById(500, function ($orders) {
            $rows = $orders->map(fn ($order) => [
                'order_id' => $order->id,
                'from_status' => null,
                'to_status' => $order->status,
                'actor_type' => 'system',
                'actor_user_id' => null,
                'actor_name' => null,
                'note' => 'Initial status snapshot; earlier status changes were not recorded.',
                'created_at' => now(),
            ])->all();
            DB::table('order_status_history')->insert($rows);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_status_history');
    }
};
