<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\AdminAuditLog;
use App\Models\Product;
use App\Models\InventoryMovement;
use App\Models\Refund;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminOrderController extends Controller
{
    public function dashboard(): JsonResponse
    {
        $today = now()->startOfDay();
        $orders = Order::query()->where('created_at', '>=', $today);
        $paid = Order::query()->whereIn('payment_status', ['paid', 'partially_refunded', 'refunded']);
        $paidRows = (clone $paid)->get(['id', 'grand_total', 'created_at']);
        $netPaidCents = $paidRows->sum(fn (Order $order) => $this->moneyCents($order->grand_total))
            - $this->moneyCents(Refund::sum('amount') ?: '0');
        $todayPaidRows = $paidRows->filter(fn (Order $order) => $order->created_at >= $today);
        $todayRefundCents = Refund::where('created_at', '>=', $today)->sum('amount');
        $todayNetPaidCents = $todayPaidRows->sum(fn (Order $order) => $this->moneyCents($order->grand_total))
            - $this->moneyCents($todayRefundCents ?: '0');

        return response()->json(['data' => [
            'orders_today' => (clone $orders)->count(),
            'pending_orders' => Order::whereIn('status', ['placed', 'processing', 'packed'])->count(),
            'paid_revenue' => $this->money($netPaidCents),
            'paid_revenue_today' => $this->money($todayNetPaidCents),
            'recent_orders' => Order::latest()->limit(5)->get(['order_number', 'customer_name', 'grand_total', 'currency', 'status', 'created_at']),
        ]]);
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(['placed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'])],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = Order::with(['items', 'statusHistory', 'refunds', 'assignee', 'assignmentHistory']);
        if ($request->user()->role === 'fulfillment') {
            $query->where('assigned_to_user_id', $request->user()->id);
        }

        $orders = $query
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($filters['date_from'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '<=', $date))
            ->when($filters['search'] ?? null, function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('order_number', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('customer_name', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return response()->json($orders->through(fn (Order $order) => $this->adminData($order, true)));
    }

    public function show(Request $request, string $orderNumber): JsonResponse
    {
        $query = Order::with(['items', 'statusHistory', 'refunds', 'assignee', 'assignmentHistory'])->where('order_number', $orderNumber);
        if ($request->user()->role === 'fulfillment') {
            $query->where('assigned_to_user_id', $request->user()->id);
        }
        $order = $query->firstOrFail();
        return response()->json(['data' => $this->adminData($order, true)]);
    }

    public function fulfillmentStaff(): JsonResponse
    {
        return response()->json(['data' => User::query()->where('role', 'fulfillment')->orderBy('name')->get(['id', 'name', 'email'])]);
    }

    public function assign(Request $request, string $orderNumber): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['present', 'nullable', 'integer', 'exists:users,id'],
        ]);
        $order = DB::transaction(function () use ($request, $orderNumber, $validated) {
            $assigneeId = $validated['user_id'] === null ? null : (int) $validated['user_id'];
            if ($assigneeId !== null && ! User::whereKey($assigneeId)->where('role', 'fulfillment')->lockForUpdate()->first()) {
                throw ValidationException::withMessages(['user_id' => ['Choose an active fulfillment staff account.']]);
            }
            $order = Order::where('order_number', $orderNumber)->lockForUpdate()->firstOrFail();
            $currentAssigneeId = $order->assigned_to_user_id === null ? null : (int) $order->assigned_to_user_id;
            if ($currentAssigneeId === $assigneeId) return $order;

            $order->assigned_to_user_id = $assigneeId;
            $order->save();
            $order->assignmentHistory()->create([
                'assigned_to_user_id' => $assigneeId,
                'assigned_by_user_id' => $request->user()->id,
            ]);
            AdminAuditLog::record(
                $request->user(), 'order.assigned', 'order', (int) $order->id, $order->order_number,
                $assigneeId === null ? "Unassigned order {$order->order_number}." : "Assigned order {$order->order_number} to fulfillment staff.",
                ['from_user_id' => $currentAssigneeId, 'to_user_id' => $assigneeId]
            );

            return $order;
        }, 3);

        $order->load(['items', 'statusHistory', 'refunds', 'assignee', 'assignmentHistory']);
        return response()->json(['data' => $this->adminData($order, true)]);
    }

    public function refund(Request $request, string $orderNumber): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'decimal:0,2'],
            'note' => ['required', 'string', 'min:3', 'max:255'],
            'idempotency_key' => ['required', 'string', 'max:64'],
        ]);

        [$order, $refund, $created] = DB::transaction(function () use ($request, $orderNumber, $validated) {
            $order = Order::where('order_number', $orderNumber)->lockForUpdate()->firstOrFail();
            $existing = Refund::where('idempotency_key', $validated['idempotency_key'])->first();
            if ($existing) {
                if ((int) $existing->order_id !== (int) $order->id) {
                    throw ValidationException::withMessages(['idempotency_key' => ['This request key has already been used.']]);
                }
                return [$order, $existing, false];
            }

            if (! in_array($order->status, ['delivered', 'refunded'], true)
                || ! in_array($order->payment_status, ['paid', 'partially_refunded'], true)) {
                throw ValidationException::withMessages(['order' => ['Only delivered, paid orders can be refunded.']]);
            }

            $amountCents = $this->moneyCents($validated['amount']);
            $totalCents = $this->moneyCents($order->grand_total);
            $refundedCents = $order->refunds()->get(['amount'])->sum(fn (Refund $item) => $this->moneyCents($item->amount));
            $remainingCents = $totalCents - $refundedCents;
            if ($amountCents > $remainingCents) {
                throw ValidationException::withMessages(['amount' => ['The refund cannot exceed the remaining refundable balance of '.$this->money($remainingCents).'.']]);
            }

            $refund = $order->refunds()->create([
                'actor_user_id' => $request->user()->id,
                'idempotency_key' => $validated['idempotency_key'],
                'amount' => $this->money($amountCents),
                'note' => $validated['note'],
            ]);
            AdminAuditLog::record(
                $request->user(), 'order.refunded', 'order', (int) $order->id, $order->order_number,
                "Recorded a {$this->money($amountCents)} refund for order {$order->order_number}.",
                ['refund_id' => $refund->id, 'amount' => $this->money($amountCents), 'reason' => $validated['note']]
            );

            $previousStatus = $order->status;
            if ($amountCents === $remainingCents) {
                $order->payment_status = 'refunded';
                $order->status = 'refunded';
                $order->save();
                $order->statusHistory()->create([
                    'from_status' => $previousStatus,
                    'to_status' => 'refunded',
                    'actor_type' => 'admin',
                    'actor_user_id' => $request->user()->id,
                    'actor_name' => $request->user()->name,
                    'note' => 'Order fully refunded: '.$validated['note'],
                ]);
            } else {
                $order->payment_status = 'partially_refunded';
                $order->save();
            }

            return [$order, $refund, true];
        }, 3);

        if ($created) {
            try {
                Mail::to($order->email)->send(new \App\Mail\RefundRecorded($order, $refund));
            } catch (\Throwable $exception) {
                Log::warning('Refund notification could not be sent.', ['order_number' => $order->order_number, 'refund_id' => $refund->id]);
            }
        }

        $order->load(['items', 'statusHistory', 'refunds']);
        return response()->json(['data' => ['order' => $this->adminData($order, true), 'refund' => $refund]], $created ? 201 : 200);
    }

    public function update(Request $request, string $orderNumber): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['processing', 'packed', 'shipped', 'delivered', 'cancelled'])],
            'shipping_carrier' => ['required_if:status,shipped', 'nullable', 'string', 'max:100'],
            'tracking_number' => ['required_if:status,shipped', 'nullable', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $order = DB::transaction(function () use ($request, $orderNumber, $validated) {
            $order = Order::where('order_number', $orderNumber)->lockForUpdate()->firstOrFail();
            if ($request->user()->role === 'fulfillment' && (int) $order->assigned_to_user_id !== (int) $request->user()->id) {
                abort(404);
            }
            $transitions = [
                'placed' => ['processing', 'cancelled'],
                'processing' => ['packed', 'cancelled'],
                'packed' => ['shipped', 'cancelled'],
                'shipped' => ['delivered'],
                'delivered' => [],
                'cancelled' => [],
            ];
            $nextStatus = $validated['status'];
            if ($request->user()->role === 'fulfillment' && $nextStatus === 'cancelled') {
                abort(403, 'Fulfillment staff cannot cancel orders. Ask an administrator for help.');
            }
            if (! in_array($nextStatus, $transitions[$order->status] ?? [], true)) {
                throw ValidationException::withMessages(['status' => ['This order cannot move to the selected status.']]);
            }

            if ($nextStatus === 'cancelled') {
                $items = $order->items()->whereNotNull('product_id')->orderBy('product_id')->get();
                $products = Product::whereIn('id', $items->pluck('product_id')->unique())->orderBy('id')->lockForUpdate()->get()->keyBy('id');
                foreach ($items as $item) {
                    if ($product = $products->get($item->product_id)) {
                        $product->increment('quantity', $item->quantity);
                        InventoryMovement::create([
                            'product_id' => $product->id,
                            'product_name' => $item->product_name,
                            'product_sku' => $item->product_sku,
                            'order_id' => $order->id,
                            'actor_user_id' => $request->user()->id,
                            'actor_type' => 'admin',
                            'quantity_delta' => (int) $item->quantity,
                            'reason' => 'order_cancelled',
                            'note' => "Stock restored when {$order->order_number} was cancelled by an administrator.",
                        ]);
                    }
                }
            }

            $previousStatus = $order->status;
            $order->status = $nextStatus;
            if ($nextStatus === 'shipped') {
                $order->shipping_carrier = $validated['shipping_carrier'];
                $order->tracking_number = $validated['tracking_number'];
                $order->shipped_at = now();
            }
            if ($nextStatus === 'delivered' && $order->payment_method === 'cash_on_delivery') {
                $order->payment_status = 'paid';
            }
            $order->save();

            $order->statusHistory()->create([
                'from_status' => $previousStatus,
                'to_status' => $nextStatus,
                'actor_type' => $request->user()->role === 'fulfillment' ? 'fulfillment' : 'admin',
                'actor_user_id' => $request->user()->id,
                'actor_name' => $request->user()->name,
                'note' => $validated['note'] ?? null,
            ]);
            AdminAuditLog::record(
                $request->user(), 'order.status_changed', 'order', (int) $order->id, $order->order_number,
                "Changed order {$order->order_number} from {$previousStatus} to {$nextStatus}.",
                ['from_status' => $previousStatus, 'to_status' => $nextStatus, 'note' => $validated['note'] ?? null]
            );

            return $order->load(['items', 'statusHistory', 'assignee', 'assignmentHistory']);
        }, 3);

        try {
            Mail::to($order->email)->send(new \App\Mail\OrderStatusChanged($order));
        } catch (\Throwable $exception) {
            Log::warning('Order status email could not be sent.', ['order_number' => $order->order_number]);
        }

        return response()->json(['data' => $this->adminData($order, true)]);
    }

    private function adminData(Order $order, bool $includeAddress = false): array
    {
        $data = [
            'order_number' => $order->order_number,
            'customer_name' => $order->customer_name,
            'email' => $order->email,
            'phone' => $order->phone,
            'subtotal' => $order->subtotal,
            'coupon_code' => $order->coupon_code,
            'discount_total' => $order->discount_total,
            'shipping_total' => $order->shipping_total,
            'tax_total' => $order->tax_total,
            'grand_total' => $order->grand_total,
            'currency' => $order->currency,
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'assigned_to' => $order->assignee ? ['id' => $order->assignee->id, 'name' => $order->assignee->name] : null,
            'refunded_total' => $this->money($order->refunds->sum(fn (Refund $refund) => $this->moneyCents($refund->amount))),
            'refunds' => $order->refunds->sortByDesc('id')->map(fn (Refund $refund) => [
                'id' => $refund->id,
                'amount' => $refund->amount,
                'note' => $refund->note,
                'created_at' => $refund->created_at,
            ])->values(),
            'status' => $order->status,
            'shipping_carrier' => $order->shipping_carrier,
            'tracking_number' => $order->tracking_number,
            'shipped_at' => $order->shipped_at,
            'status_history' => $order->statusHistory->map(fn ($event) => [
                'from_status' => $event->from_status,
                'to_status' => $event->to_status,
                'actor_type' => $event->actor_type,
                'actor_name' => $event->actor_name,
                'note' => $event->note,
                'created_at' => $event->created_at,
            ])->values(),
            'created_at' => $order->created_at,
            'items' => $order->items->map(fn ($item) => [
                'product_name' => $item->product_name,
                'sku' => $item->product_sku,
                'unit_price' => $item->unit_price,
                'quantity' => $item->quantity,
                'line_total' => $item->line_total,
            ])->values(),
        ];

        if ($includeAddress) {
            $data['address'] = [
                'address_line1' => $order->address_line1,
                'address_line2' => $order->address_line2,
                'city' => $order->city,
                'region' => $order->region,
                'postal_code' => $order->postal_code,
                'country' => $order->country,
            ];
        }

        if (request()->user()?->role === 'admin') {
            $data['assignment_history'] = $order->assignmentHistory->map(fn ($assignment) => [
                'assigned_to' => $assignment->assignee?->name,
                'assigned_by' => $assignment->assigner?->name,
                'created_at' => $assignment->created_at,
            ])->values();
        }

        if (request()->user()?->role === 'fulfillment') {
            unset($data['payment_method'], $data['payment_status'], $data['refunded_total'], $data['refunds']);
        }

        return $data;
    }

    private function moneyCents(string|int|float $value): int
    {
        $parts = explode('.', (string) $value, 2);
        return ((int) $parts[0] * 100) + (int) str_pad(substr($parts[1] ?? '', 0, 2), 2, '0');
    }

    private function money(int $cents): string
    {
        return intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
