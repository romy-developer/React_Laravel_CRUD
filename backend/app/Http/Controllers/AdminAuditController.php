<?php

namespace App\Http\Controllers;

use App\Models\AdminAuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminAuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'action' => ['nullable', Rule::in([
                'product.created', 'product.updated', 'product.deleted',
                'coupon.created', 'coupon.updated', 'coupon.disabled',
                'staff.access_granted', 'staff.access_removed',
                'order.assigned', 'order.status_changed', 'order.refunded',
            ])],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $logs = AdminAuditLog::query()
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('summary', 'like', "%{$search}%")
                        ->orWhere('subject_label', 'like', "%{$search}%")
                        ->orWhere('actor_name', 'like', "%{$search}%");
                });
            })
            ->when($filters['action'] ?? null, fn ($query, $action) => $query->where('action', $action))
            ->when($filters['date_from'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '<=', $date))
            ->with('actor:id,name')
            ->latest('id')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (AdminAuditLog $log) => [
                'id' => $log->id,
                'actor' => $log->actor_name,
                'action' => $log->action,
                'subject_type' => $log->subject_type,
                'subject_label' => $log->subject_label,
                'summary' => $log->summary,
                'metadata' => $log->metadata,
                'created_at' => $log->created_at,
            ]);

        return response()->json($logs);
    }
}
