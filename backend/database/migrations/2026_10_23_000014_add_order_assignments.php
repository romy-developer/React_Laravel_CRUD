<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('assigned_to_user_id')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            $table->index(['assigned_to_user_id', 'status', 'created_at'], 'orders_assignee_status_created_idx');
        });

        Schema::create('order_assignment_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['order_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_assignment_history');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_assignee_status_created_idx');
            $table->dropConstrainedForeignId('assigned_to_user_id');
        });
    }
};
