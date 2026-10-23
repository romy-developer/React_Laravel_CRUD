<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Product;
use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\InventoryMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;
use Illuminate\Validation\ValidationException;

class CheckoutController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:40'],
            'address_line1' => ['required', 'string', 'max:255'],
            'address_line2' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:120'],
            'region' => ['required', 'string', 'max:120'],
            'postal_code' => ['required', 'string', 'max:24'],
            'country' => ['required', 'string', 'size:2'],
            'payment_method' => ['required', 'in:cash_on_delivery'],
            'accept_policy' => ['accepted'],
            'save_address' => ['nullable', 'boolean'],
            'coupon_code' => ['nullable', 'string', 'max:40'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'integer', 'distinct', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
        ]);

        $idempotencyKey = $request->header('Idempotency-Key');
        $accessToken = $request->header('X-Order-Access-Token');
        validator([
            'idempotency_key' => $idempotencyKey,
            'access_token' => $accessToken,
        ], [
            'idempotency_key' => ['required', 'uuid'],
            'access_token' => ['required', 'uuid'],
        ])->validate();

        $tokenHash = hash('sha256', $accessToken);
        $customer = $request->user();
        if ($customer?->role !== 'customer') {
            $customer = null;
        }
        $existing = Order::with('items')->where('idempotency_key', $idempotencyKey)->first();
        if ($existing) {
            abort_unless(hash_equals($existing->access_token_hash, $tokenHash), 404);
            return $this->orderResponse($existing, $accessToken, 200);
        }

        try {
            $order = DB::transaction(function () use ($validated, $idempotencyKey, $tokenHash, $customer) {
                $requested = collect($validated['items'])->keyBy('product_id');
                $products = Product::query()
                    ->whereIn('id', $requested->keys())
                    ->where('is_published', true)
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');
    
                if ($products->count() !== $requested->count()) {
                    throw ValidationException::withMessages(['items' => ['One or more products are no longer available. Refresh your cart and try again.']]);
                }
    
                $subtotalCents = 0;
                $lines = [];
                foreach ($requested as $productId => $line) {
                    $product = $products->get($productId);
                    $quantity = (int) $line['quantity'];
                    if ($quantity > $product->quantity) {
                        throw ValidationException::withMessages([
                            'items' => ["Only {$product->quantity} unit(s) of {$product->name} are currently available."],
                        ]);
                    }
                    [$whole, $fraction] = array_pad(explode('.', (string) $product->price, 2), 2, '');
                    $unitCents = ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');
                    $lineCents = $unitCents * $quantity;
                    $subtotalCents += $lineCents;
                    $lines[] = compact('product', 'quantity', 'unitCents', 'lineCents');
                }
    
                $coupon = null;
                $discountCents = 0;
                if (! empty($validated['coupon_code'])) {
                    $coupon = Coupon::whereRaw('UPPER(code) = ?', [strtoupper($validated['coupon_code'])])->lockForUpdate()->first();
                    if (! $coupon) {
                        throw ValidationException::withMessages(['coupon_code' => ['That coupon code is not valid.']]);
                    }
                    $discountCents = CouponController::calculateDiscount($coupon, $subtotalCents);
                }
    
                $order = Order::create([
                    'user_id' => $customer?->id,
                    'order_number' => 'FN-'.strtoupper(bin2hex(random_bytes(5))),
                    'idempotency_key' => $idempotencyKey,
                    'access_token_hash' => $tokenHash,
                    'customer_name' => $validated['customer_name'],
                    'email' => $validated['email'],
                    'phone' => $validated['phone'],
                    'address_line1' => $validated['address_line1'],
                    'address_line2' => $validated['address_line2'] ?? null,
                    'city' => $validated['city'],
                    'region' => $validated['region'],
                    'postal_code' => $validated['postal_code'],
                    'country' => strtoupper($validated['country']),
                    'subtotal' => $this->money($subtotalCents),
                    'coupon_code' => $coupon?->code,
                    'discount_total' => $this->money($discountCents),
                    'shipping_total' => $this->money(0),
                    'tax_total' => $this->money(0),
                    'grand_total' => $this->money($subtotalCents - $discountCents),
                    'currency' => 'USD',
                    'payment_method' => 'cash_on_delivery',
                    'payment_status' => 'pending',
                    'status' => 'placed',
                ]);
    
                $order->statusHistory()->create([
                    'from_status' => null,
                    'to_status' => 'placed',
                    'actor_type' => $customer ? 'customer' : 'guest',
                    'actor_user_id' => $customer?->id,
                    'note' => 'Order placed.',
                ]);
    
                foreach ($lines as $line) {
                    $order->items()->create([
                        'product_id' => $line['product']->id,
                        'product_name' => $line['product']->name,
                        'product_sku' => $line['product']->sku,
                        'unit_price' => $this->money($line['unitCents']),
                        'quantity' => $line['quantity'],
                        'line_total' => $this->money($line['lineCents']),
                    ]);
                    $line['product']->decrement('quantity', $line['quantity']);
                    InventoryMovement::create([
                        'product_id' => $line['product']->id,
                        'product_name' => $line['product']->name,
                        'product_sku' => $line['product']->sku,
                        'order_id' => $order->id,
                        'actor_user_id' => $customer?->id,
                        'actor_type' => $customer ? 'customer' : 'guest',
                        'quantity_delta' => -$line['quantity'],
                        'reason' => 'order_placed',
                        'note' => "Stock reserved for {$order->order_number}.",
                    ]);
                }
    
                if ($coupon) {
                    CouponRedemption::create([
                        'coupon_id' => $coupon->id,
                        'order_id' => $order->id,
                        'user_id' => $customer?->id,
                        'email' => $validated['email'],
                        'discount_total' => $this->money($discountCents),
                    ]);
                }
    
                if ($customer && ($validated['save_address'] ?? false)) {
                    $customer->addresses()->create([
                        'label' => 'Home',
                        'recipient_name' => $validated['customer_name'],
                        'phone' => $validated['phone'],
                        'address_line1' => $validated['address_line1'],
                        'address_line2' => $validated['address_line2'] ?? null,
                        'city' => $validated['city'],
                        'region' => $validated['region'],
                        'postal_code' => $validated['postal_code'],
                        'country' => strtoupper($validated['country']),
                        'is_default' => ! $customer->addresses()->exists(),
                    ]);
                }
    
                return $order->load(['items', 'statusHistory']);
            }, 3);
        } catch (QueryException $exception) {
            // A concurrent retry can pass the initial lookup before the first
            // request commits. The unique idempotency key makes the loser roll
            // back its stock changes; return the winner's order instead.
            $existing = Order::with(['items', 'statusHistory'])
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if (! $existing) {
                throw $exception;
            }

            abort_unless(hash_equals($existing->access_token_hash, $tokenHash), 404);
            return $this->orderResponse($existing, $accessToken, 200);
        }

        try {
            Mail::to($order->email)->send(new \App\Mail\OrderPlaced($order));
        } catch (\Throwable $exception) {
            Log::warning('Order confirmation email could not be sent.', ['order_number' => $order->order_number]);
        }

        return $this->orderResponse($order, $accessToken, 201);
    }

    public function show(Request $request, string $orderNumber): JsonResponse
    {
        $accessToken = $request->header('X-Order-Access-Token', '');
        abort_unless($accessToken !== '', 404);

        $order = Order::with('items')->withSum('refunds as refunded_total', 'amount')->where('order_number', $orderNumber)->firstOrFail();
        abort_unless(hash_equals($order->access_token_hash, hash('sha256', $accessToken)), 404);

        return response()->json(['data' => $this->safeOrder($order)]);
    }

    public function cancel(Request $request, string $orderNumber): JsonResponse
    {
        $accessToken = $request->header('X-Order-Access-Token', '');
        abort_unless($accessToken !== '', 404);
        $tokenHash = hash('sha256', $accessToken);
        $alreadyCancelled = false;

        $order = DB::transaction(function () use ($orderNumber, $tokenHash, &$alreadyCancelled) {
            $order = Order::where('order_number', $orderNumber)->lockForUpdate()->firstOrFail();
            abort_unless(hash_equals($order->access_token_hash, $tokenHash), 404);

            // Keep cancellation retries safe: stock is restored only once.
            if ($order->status === 'cancelled' && $order->payment_status === 'pending') {
                $alreadyCancelled = true;
                return $order->load(['items', 'statusHistory']);
            }
            if ($order->status !== 'placed' || $order->payment_status !== 'pending') {
                throw ValidationException::withMessages(['order' => ['This order is no longer eligible for cancellation.']]);
            }

            $items = $order->items()->whereNotNull('product_id')->orderBy('product_id')->get();
            $products = Product::whereIn('id', $items->pluck('product_id')->unique())
                ->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            foreach ($items as $item) {
                if ($product = $products->get($item->product_id)) {
                    $product->increment('quantity', $item->quantity);
                    InventoryMovement::create([
                        'product_id' => $product->id,
                        'product_name' => $item->product_name,
                        'product_sku' => $item->product_sku,
                        'order_id' => $order->id,
                        'actor_type' => $order->user_id ? 'customer' : 'guest',
                        'quantity_delta' => (int) $item->quantity,
                        'reason' => 'order_cancelled',
                        'note' => "Stock restored when {$order->order_number} was cancelled by the shopper.",
                    ]);
                }
            }

            $order->update(['status' => 'cancelled']);
            $order->statusHistory()->create([
                'from_status' => 'placed',
                'to_status' => 'cancelled',
                'actor_type' => $order->user_id ? 'customer' : 'guest',
                'actor_user_id' => $order->user_id,
                'note' => 'Shopper requested cancellation through the private order link.',
            ]);

            return $order->load(['items', 'statusHistory']);
        }, 3);

        if (! $alreadyCancelled) {
            try {
                Mail::to($order->email)->send(new \App\Mail\OrderStatusChanged($order));
            } catch (\Throwable $exception) {
                Log::warning('Order cancellation email could not be sent.', ['order_number' => $order->order_number]);
            }
        }

        return response()->json(['data' => $this->safeOrder($order)]);
    }

    private function orderResponse(Order $order, string $accessToken, int $status): JsonResponse
    {
        return response()->json([
            'data' => [
                ...$this->safeOrder($order),
                'access_token' => $accessToken,
            ],
        ], $status);
    }

    private function safeOrder(Order $order): array
    {
        return [
            'order_number' => $order->order_number,
            'customer_name' => $order->customer_name,
            'email' => $order->email,
            'address' => [
                'address_line1' => $order->address_line1,
                'address_line2' => $order->address_line2,
                'city' => $order->city,
                'region' => $order->region,
                'postal_code' => $order->postal_code,
                'country' => $order->country,
            ],
            'items' => $order->items->map(fn ($item) => [
                'product_name' => $item->product_name,
                'sku' => $item->product_sku,
                'unit_price' => $item->unit_price,
                'quantity' => $item->quantity,
                'line_total' => $item->line_total,
            ])->values(),
            'subtotal' => $order->subtotal,
            'coupon_code' => $order->coupon_code,
            'discount_total' => $order->discount_total,
            'shipping_total' => $order->shipping_total,
            'tax_total' => $order->tax_total,
            'grand_total' => $order->grand_total,
            'currency' => $order->currency,
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'refunded_total' => $order->refunded_total ?? '0.00',
            'status' => $order->status,
            'shipping_carrier' => $order->shipping_carrier,
            'tracking_number' => $order->tracking_number,
            'shipped_at' => $order->shipped_at,
            'status_history' => $order->statusHistory->map(fn ($event) => [
                'from_status' => $event->from_status,
                'to_status' => $event->to_status,
                'actor_type' => $event->actor_type,
                'actor_name' => $event->actor_type === 'admin' ? 'Store team' : ($event->actor_type === 'customer' ? 'You' : null),
                'note' => $event->actor_type === 'system' && $event->from_status === null ? $event->note : null,
                'created_at' => $event->created_at,
            ])->values(),
            'created_at' => $order->created_at,
        ];
    }

    private function money(int $cents): string
    {
        return intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
