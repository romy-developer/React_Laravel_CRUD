<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminAuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'actor_user_id', 'actor_name', 'action', 'subject_type', 'subject_id',
        'subject_label', 'summary', 'metadata', 'created_at',
    ];

    protected function casts(): array
    {
        return ['metadata' => 'array', 'created_at' => 'datetime'];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public static function record(User $actor, string $action, string $subjectType, ?int $subjectId, ?string $subjectLabel, string $summary, array $metadata = []): self
    {
        return self::create([
            'actor_user_id' => $actor->id,
            'actor_name' => $actor->name,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'subject_label' => $subjectLabel,
            'summary' => $summary,
            'metadata' => $metadata ?: null,
            'created_at' => now(),
        ]);
    }
}
