<?php

namespace App\Http\Controllers;

use App\Models\Coupon;
use App\Models\AdminAuditLog;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CouponController extends Controller
{
    public function storefrontPromotions(): JsonResponse
    {
        $now = now();
        $promotions = Coupon::query()
            ->where('is_active', true)
            ->where('is_promoted', true)
            ->where(fn ($query) => $query->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>=', $now))
            ->withCount('redemptions')
            ->latest()
            ->limit(12)
            ->get()
            ->filter(fn (Coupon $coupon) => $coupon->max_redemptions === null || $coupon->redemptions_count < $coupon->max_redemptions)
            ->take(3)
            ->values()
            ->map(fn (Coupon $coupon) => [
                'code' => $coupon->code,
                'description' => $coupon->description,
                'discount_type' => $coupon->discount_type,
                'discount_value' => $coupon->discount_value,
                'minimum_subtotal' => $coupon->minimum_subtotal,
                'ends_at' => $coupon->ends_at,
            ]);

        return response()->json(['data' => $promotions]);
    }

    public function index(): JsonResponse
    {
        $coupons = Coupon::withCount('redemptions')->latest()->get();
        return response()->json(['data' => $coupons]);
    }

    public function store(Request $request): JsonResponse
    {
        $values = $this->validateCoupon($request);
        $values['code'] = strtoupper($values['code']);
        $coupon = DB::transaction(function () use ($request, $values) {
            $coupon = Coupon::create($values);
            AdminAuditLog::record($request->user(), 'coupon.created', 'coupon', (int) $coupon->id, $coupon->code, "Created coupon {$coupon->code}.", ['fields' => array_keys($values)]);
            return $coupon;
        });
        return response()->json(['data' => $coupon->loadCount('redemptions')], 201);
    }

    public function update(Request $request, Coupon $coupon): JsonResponse
    {
        $values = $this->validateCoupon($request, $coupon);
        $values['code'] = strtoupper($values['code']);
        $coupon = DB::transaction(function () use ($request, $coupon, $values) {
            $locked = Coupon::whereKey($coupon->id)->lockForUpdate()->firstOrFail();
            $oldCode = $locked->code;
            $locked->update($values);
            AdminAuditLog::record($request->user(), 'coupon.updated', 'coupon', (int) $locked->id, $locked->code, "Updated coupon {$oldCode}.", ['fields' => array_keys($values)]);
            return $locked;
        });
        return response()->json(['data' => $coupon->refresh()->loadCount('redemptions')]);
    }

    public function destroy(Request $request, Coupon $coupon): JsonResponse
    {
        $coupon = DB::transaction(function () use ($request, $coupon) {
            $locked = Coupon::whereKey($coupon->id)->lockForUpdate()->firstOrFail();
            if ($locked->is_active) {
                $locked->update(['is_active' => false]);
                AdminAuditLog::record($request->user(), 'coupon.disabled', 'coupon', (int) $locked->id, $locked->code, "Disabled coupon {$locked->code}.");
            }
            return $locked;
        });
        return response()->json(['message' => 'Coupon disabled.', 'data' => $coupon->refresh()->loadCount('redemptions')]);
    }

    public function validateForStore(Request $request): JsonResponse
    {
        $values = $request->validate([
            'code' => ['required', 'string', 'max:40'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'integer', 'distinct', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
        ]);
        $lines = collect($values['items'])->keyBy('product_id');
        $products = Product::whereIn('id', $lines->keys())->where('is_published', true)->get()->keyBy('id');
        if ($products->count() !== $lines->count()) {
            throw ValidationException::withMessages(['items' => ['One or more cart items are no longer available.']]);
        }
        $subtotalCents = 0;
        foreach ($lines as $id => $line) {
            $subtotalCents += $this->toCents($products->get($id)->price) * (int) $line['quantity'];
        }

        $coupon = Coupon::whereRaw('UPPER(code) = ?', [strtoupper($values['code'])])->first();
        if (! $coupon) {
            throw ValidationException::withMessages(['coupon_code' => ['That coupon code is not valid.']]);
        }
        $discountCents = $this->discountFor($coupon, $subtotalCents);

        return response()->json(['data' => [
            'code' => $coupon->code,
            'subtotal' => $this->money($subtotalCents),
            'discount_total' => $this->money($discountCents),
            'grand_total' => $this->money(max(0, $subtotalCents - $discountCents)),
        ]]);
    }

    private function validateCoupon(Request $request, ?Coupon $coupon = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:40', Rule::unique('coupons', 'code')->ignore($coupon?->id)],
            'description' => ['nullable', 'string', 'max:160'],
            'discount_type' => ['required', Rule::in(['percentage', 'fixed'])],
            'discount_value' => ['required', 'numeric', 'gt:0', 'max:'.($request->input('discount_type') === 'percentage' ? '100' : '99999999')],
            'minimum_subtotal' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'max_redemptions' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['required', 'boolean'],
            'is_promoted' => ['required', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);
    }

    public static function ensureAvailable(Coupon $coupon, int $subtotalCents): void
    {
        $now = now();
        if (! $coupon->is_active || ($coupon->starts_at && $coupon->starts_at->isFuture()) || ($coupon->ends_at && $coupon->ends_at->isPast())) {
            throw ValidationException::withMessages(['coupon_code' => ['This coupon is not currently active.']]);
        }
        if ($subtotalCents < self::toCents($coupon->minimum_subtotal)) {
            throw ValidationException::withMessages(['coupon_code' => ['Your order does not meet this coupon minimum.']]);
        }
        if ($coupon->max_redemptions !== null && $coupon->redemptions()->count() >= $coupon->max_redemptions) {
            throw ValidationException::withMessages(['coupon_code' => ['This coupon has reached its redemption limit.']]);
        }
    }

    public static function calculateDiscount(Coupon $coupon, int $subtotalCents): int
    {
        self::ensureAvailable($coupon, $subtotalCents);
        $discountCents = $coupon->discount_type === 'percentage'
            ? intdiv($subtotalCents * self::toHundredths($coupon->discount_value), 10000)
            : self::toCents($coupon->discount_value);
        return min($subtotalCents, $discountCents);
    }

    private function discountFor(Coupon $coupon, int $subtotalCents): int
    {
        return self::calculateDiscount($coupon, $subtotalCents);
    }

    private static function toCents(string|int|float $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', (string) $amount, 2), 2, '');
        return ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');
    }

    private static function toHundredths(string|int|float $amount): int
    {
        return self::toCents($amount);
    }

    private function money(int $cents): string
    {
        return intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
