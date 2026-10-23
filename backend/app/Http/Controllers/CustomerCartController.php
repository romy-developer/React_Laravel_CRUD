<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerCartController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $cart = $this->cartFor($request->user());
        $this->refreshAvailableLines($cart);
        return response()->json(['data' => $this->items($cart)]);
    }

    public function sync(Request $request): JsonResponse
    {
        $items = $this->validateItems($request);
        $cart = DB::transaction(function () use ($request, $items) {
            $cart = $this->cartFor($request->user());
            return $this->replaceLines($cart, $items);
        }, 3);

        return response()->json(['data' => $this->items($cart)]);
    }

    private function validateItems(Request $request): array
    {
        return $request->validate([
            'items' => ['present', 'array', 'max:50'],
            'items.*.id' => ['required', 'integer', 'distinct', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
        ])['items'];
    }

    private function cartFor(User $user): Cart
    {
        return $user->cart()->firstOrCreate([]);
    }

    private function replaceLines(Cart $cart, array $incoming): Cart
    {
        $quantities = collect($incoming)->mapWithKeys(fn ($line) => [(int) $line['id'] => (int) $line['quantity']])->all();

        $products = Product::whereIn('id', array_keys($quantities))
            ->where('is_published', true)
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        $cart->items()->delete();
        foreach ($quantities as $productId => $quantity) {
            $product = $products->get($productId);
            if (! $product || $product->quantity < 1) continue;
            $cart->items()->create([
                'product_id' => $product->id,
                'quantity' => min((int) $quantity, (int) $product->quantity),
            ]);
        }

        return $cart->fresh();
    }

    private function refreshAvailableLines(Cart $cart): void
    {
        DB::transaction(function () use ($cart) {
            $lines = $cart->items()->with('product')->get();
            foreach ($lines as $line) {
                $product = $line->product;
                if (! $product || ! $product->is_published || $product->quantity < 1) {
                    $line->delete();
                    continue;
                }
                if ($line->quantity > $product->quantity) {
                    $line->update(['quantity' => $product->quantity]);
                }
            }
        });
    }

    private function items(Cart $cart): array
    {
        return $cart->items()->with('product')->get()->map(function ($line) {
            $product = $line->product;
            if (! $product || ! $product->is_published || $product->quantity < 1) return null;
            return [
                'id' => $product->id,
                'name' => $product->name,
                'price' => $product->price,
                'image_url' => $product->image_url,
                'available' => (int) $product->quantity,
                'quantity' => min((int) $line->quantity, (int) $product->quantity),
            ];
        })->filter()->values()->all();
    }
}
