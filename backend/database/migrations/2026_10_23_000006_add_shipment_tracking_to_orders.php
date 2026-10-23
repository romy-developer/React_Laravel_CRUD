<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('shipping_carrier', 100)->nullable()->after('status');
            $table->string('tracking_number', 120)->nullable()->after('shipping_carrier');
            $table->timestamp('shipped_at')->nullable()->after('tracking_number');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['shipping_carrier', 'tracking_number', 'shipped_at']);
        });
    }
};
