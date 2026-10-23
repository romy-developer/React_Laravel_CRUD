<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name');
            $table->string('action', 64)->index();
            $table->string('subject_type', 64)->index();
            $table->unsignedBigInteger('subject_id')->nullable()->index();
            $table->string('subject_label', 160)->nullable();
            $table->string('summary', 255);
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
            $table->index(['subject_type', 'subject_id', 'created_at'], 'admin_audit_subject_time_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_audit_logs');
    }
};
