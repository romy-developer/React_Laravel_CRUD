<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminCustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $customers = User::query()
            ->where('role', 'customer')
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->withCount('orders')
            ->withMax('orders', 'created_at')
            ->latest()
            ->paginate(20)
            ->withQueryString()
            ->through(fn (User $customer) => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'email_verified' => $customer->hasVerifiedEmail(),
                'orders_count' => $customer->orders_count,
                'last_order_at' => $customer->orders_max_created_at,
                'created_at' => $customer->created_at,
            ]);

        return response()->json($customers);
    }

    public function show(int $customerId): JsonResponse
    {
        $customer = User::query()->where('role', 'customer')->findOrFail($customerId);
        $orders = $customer->orders()
            ->with(['items', 'statusHistory'])
            ->withSum('refunds as refunded_total', 'amount')
            ->latest()
            ->paginate(10);

        return response()->json(['data' => [
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'email_verified' => $customer->hasVerifiedEmail(),
                'created_at' => $customer->created_at,
            ],
            'addresses' => $customer->addresses()->latest()->get([
                'id', 'label', 'recipient_name', 'phone', 'address_line1', 'address_line2',
                'city', 'region', 'postal_code', 'country', 'is_default',
            ]),
            'orders' => $orders->through(fn (Order $order) => [
                'order_number' => $order->order_number,
                'status' => $order->status,
                'payment_status' => $order->payment_status,
                'payment_method' => $order->payment_method,
                'currency' => $order->currency,
                'grand_total' => $order->grand_total,
                'refunded_total' => $order->refunded_total ?? '0.00',
                'created_at' => $order->created_at,
                'items' => $order->items->map(fn ($item) => [
                    'product_name' => $item->product_name,
                    'sku' => $item->product_sku,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'line_total' => $item->line_total,
                ])->values(),
                'status_history' => $order->statusHistory->map(fn ($event) => [
                    'to_status' => $event->to_status,
                    'actor_name' => $event->actor_name,
                    'note' => $event->note,
                    'created_at' => $event->created_at,
                ])->values(),
            ]),
        ]]);
    }
}
