<?php

namespace App\Http\Controllers;

use App\Models\ApiToken;
use App\Models\AdminAuditLog;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminStaffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'role' => ['nullable', Rule::in(['customer', 'fulfillment'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $staff = User::query()
            ->whereIn('role', ['customer', 'fulfillment'])
            ->when($filters['role'] ?? null, fn ($query, $role) => $query->where('role', $role))
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->withCount(['assignedOrders as assigned_orders_count'])
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'email_verified' => $user->hasVerifiedEmail(),
                'assigned_orders_count' => $user->assigned_orders_count,
                'created_at' => $user->created_at,
            ]);

        return response()->json($staff);
    }

    public function update(Request $request, int $userId): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', Rule::in(['customer', 'fulfillment'])],
        ]);

        $user = DB::transaction(function () use ($request, $userId, $validated) {
            $user = User::whereIn('role', ['customer', 'fulfillment'])->lockForUpdate()->findOrFail($userId);
            if ($user->id === $request->user()->id) {
                throw ValidationException::withMessages(['role' => ['You cannot change your own access.']]);
            }

            $previousRole = $user->role;
            $nextRole = $validated['role'];
            if ($previousRole === $nextRole) return $user;

            if ($previousRole === 'fulfillment' && $nextRole === 'customer') {
                $orders = Order::where('assigned_to_user_id', $user->id)->orderBy('id')->lockForUpdate()->get();
                foreach ($orders as $order) {
                    $order->update(['assigned_to_user_id' => null]);
                    $order->assignmentHistory()->create([
                        'assigned_to_user_id' => null,
                        'assigned_by_user_id' => $request->user()->id,
                    ]);
                }
            }

            $user->update(['role' => $nextRole]);
            ApiToken::where('user_id', $user->id)->delete();
            AdminAuditLog::record(
                $request->user(),
                $nextRole === 'fulfillment' ? 'staff.access_granted' : 'staff.access_removed',
                'user',
                (int) $user->id,
                $user->name,
                $nextRole === 'fulfillment' ? "Granted fulfillment access to {$user->name}." : "Removed fulfillment access from {$user->name}.",
                ['from_role' => $previousRole, 'to_role' => $nextRole]
            );

            return $user->refresh();
        }, 3);

        return response()->json(['data' => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'email_verified' => $user->hasVerifiedEmail(),
        ]]);
    }
}
