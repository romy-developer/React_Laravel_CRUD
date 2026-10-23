<?php

namespace App\Http\Controllers;

use App\Models\Address;
use App\Models\Order;
use App\Models\Product;
use App\Models\InventoryMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CustomerAccountController extends Controller
{
    public function profile(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->profileData($request)]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($request->user()->id)],
        ]);
        $user = $request->user();
        $emailChanged = $user->email !== $validated['email'];
        $user->update($validated);
        if ($emailChanged) {
            $user->markEmailAsUnverified();
            $user->sendEmailVerificationNotification();
        }

        return response()->json(['data' => $this->profileData($request)]);
    }

    public function addresses(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()->addresses()->orderByDesc('is_default')->latest()->get()]);
    }

    public function storeAddress(Request $request): JsonResponse
    {
        $validated = $this->validateAddress($request);
        $user = $request->user();
        $address = DB::transaction(function () use ($user, $validated) {
            $makeDefault = ($validated['is_default'] ?? false) || ! $user->addresses()->exists();
            if ($makeDefault) {
                $user->addresses()->update(['is_default' => false]);
            }
            $validated['is_default'] = $makeDefault;
            return $user->addresses()->create($validated);
        });

        return response()->json(['data' => $address], 201);
    }

    public function updateAddress(Request $request, int $addressId): JsonResponse
    {
        $validated = $this->validateAddress($request);
        $user = $request->user();
        $address = $user->addresses()->findOrFail($addressId);
        DB::transaction(function () use ($user, $address, $validated) {
            $wasDefault = $address->is_default;
            $isLastAddress = $user->addresses()->count() === 1;
            if (($validated['is_default'] ?? false) || ($wasDefault && $isLastAddress)) {
                $user->addresses()->update(['is_default' => false]);
                $validated['is_default'] = true;
            }
            $address->update($validated);
            if ($wasDefault && ! $address->is_default) {
                $user->addresses()->where('id', '<>', $address->id)->latest()->first()?->update(['is_default' => true]);
            }
        });

        return response()->json(['data' => $address->refresh()]);
    }

    public function destroyAddress(Request $request, int $addressId): JsonResponse
    {
        $user = $request->user();
        $address = $user->addresses()->findOrFail($addressId);
        DB::transaction(function () use ($user, $address) {
            $wasDefault = $address->is_default;
            $address->delete();
            if ($wasDefault) {
                $replacement = $user->addresses()->latest()->first();
                $replacement?->update(['is_default' => true]);
            }
        });

        return response()->json(['message' => 'Address deleted.']);
    }

    public function orders(Request $request): JsonResponse
    {
        $orders = $request->user()->orders()->with(['items', 'statusHistory'])->withSum('refunds as refunded_total', 'amount')->latest()->paginate(10);
        return response()->json($orders->through(fn (Order $order) => $this->orderData($order)));
    }

    public function showOrder(Request $request, string $orderNumber): JsonResponse
    {
        $order = $request->user()->orders()->with(['items', 'statusHistory'])->withSum('refunds as refunded_total', 'amount')->where('order_number', $orderNumber)->firstOrFail();
        return response()->json(['data' => $this->orderData($order)]);
    }

    public function cancelOrder(Request $request, string $orderNumber): JsonResponse
    {
        $order = DB::transaction(function () use ($request, $orderNumber) {
            $order = $request->user()->orders()->where('order_number', $orderNumber)->lockForUpdate()->firstOrFail();
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
                        'actor_user_id' => $request->user()->id,
                        'actor_type' => 'customer',
                        'quantity_delta' => (int) $item->quantity,
                        'reason' => 'order_cancelled',
                        'note' => "Stock restored when {$order->order_number} was cancelled by the customer.",
                    ]);
                }
            }

            $order->update(['status' => 'cancelled']);
            $order->statusHistory()->create([
                'from_status' => 'placed',
                'to_status' => 'cancelled',
                'actor_type' => 'customer',
                'actor_user_id' => $request->user()->id,
                'note' => 'Customer requested cancellation.',
            ]);
            return $order->load(['items', 'statusHistory']);
        }, 3);

        try {
            Mail::to($order->email)->send(new \App\Mail\OrderStatusChanged($order));
        } catch (\Throwable $exception) {
            Log::warning('Order cancellation email could not be sent.', ['order_number' => $order->order_number]);
        }

        return response()->json(['data' => $this->orderData($order)]);
    }

    private function validateAddress(Request $request): array
    {
        return $request->validate([
            'label' => ['required', 'string', 'max:80'],
            'recipient_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:40'],
            'address_line1' => ['required', 'string', 'max:255'],
            'address_line2' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:120'],
            'region' => ['required', 'string', 'max:120'],
            'postal_code' => ['required', 'string', 'max:24'],
            'country' => ['required', 'string', 'size:2'],
            'is_default' => ['nullable', 'boolean'],
        ]);
    }

    private function profileData(Request $request): array
    {
        return [
            'id' => $request->user()->id,
            'name' => $request->user()->name,
            'email' => $request->user()->email,
            'role' => $request->user()->role,
            'email_verified' => $request->user()->hasVerifiedEmail(),
        ];
    }

    private function orderData(Order $order): array
    {
        return [
            'order_number' => $order->order_number,
            'customer_name' => $order->customer_name,
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
            'payment_status' => $order->payment_status,
            'refunded_total' => $order->refunded_total ?? '0.00',
            'payment_method' => $order->payment_method,
            'subtotal' => $order->subtotal,
            'coupon_code' => $order->coupon_code,
            'discount_total' => $order->discount_total,
            'shipping_total' => $order->shipping_total,
            'tax_total' => $order->tax_total,
            'grand_total' => $order->grand_total,
            'currency' => $order->currency,
            'created_at' => $order->created_at,
            'address' => [
                'address_line1' => $order->address_line1,
                'address_line2' => $order->address_line2,
                'city' => $order->city,
                'region' => $order->region,
                'postal_code' => $order->postal_code,
                'country' => $order->country,
            ],
            'items' => $order->items->map(fn ($item) => [
                'product_id' => $item->product_id,
                'product_name' => $item->product_name,
                'sku' => $item->product_sku,
                'unit_price' => $item->unit_price,
                'quantity' => $item->quantity,
                'line_total' => $item->line_total,
            ])->values(),
        ];
    }
}
