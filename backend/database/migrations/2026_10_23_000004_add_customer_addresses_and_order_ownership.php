<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('label', 80)->default('Home');
            $table->string('recipient_name');
            $table->string('phone', 40);
            $table->string('address_line1');
            $table->string('address_line2')->nullable();
            $table->string('city', 120);
            $table->string('region', 120);
            $table->string('postal_code', 24);
            $table->string('country', 2)->default('US');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            $table->index(['user_id', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('addresses');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropIndex(['user_id', 'created_at']);
            $table->dropColumn('user_id');
        });
    }
};
