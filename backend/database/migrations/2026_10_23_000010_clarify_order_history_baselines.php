<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('order_status_history')
            ->whereNull('from_status')
            ->where('actor_type', 'system')
            ->where('note', 'Order status recorded when timeline history was introduced.')
            ->update([
                'note' => 'Initial status snapshot; earlier status changes were not recorded.',
                'created_at' => now(),
            ]);
    }

    public function down(): void
    {
        // The baseline events are required to keep historical orders visible in the timeline.
    }
};
