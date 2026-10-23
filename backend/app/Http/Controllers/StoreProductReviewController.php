<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductReview;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StoreProductReviewController extends Controller
{
    public function mine(Request $request, int $productId): JsonResponse
    {
        Product::where('is_published', true)->findOrFail($productId);
        $review = $request->user()->productReviews()->where('product_id', $productId)->first();

        return response()->json(['data' => $review ? [
            'rating' => $review->rating,
            'title' => $review->title,
            'body' => $review->body,
        ] : null]);
    }

    public function index(int $productId): JsonResponse
    {
        $product = Product::where('is_published', true)->findOrFail($productId);
        $counts = $product->reviews()->selectRaw('rating, COUNT(*) as review_count')->groupBy('rating')->pluck('review_count', 'rating');
        $reviews = $product->reviews()
            ->with('customer:id,name')
            ->latest()
            ->paginate(10)
            ->through(fn (ProductReview $review) => [
                'id' => $review->id,
                'rating' => $review->rating,
                'title' => $review->title,
                'body' => $review->body,
                'customer_name' => 'Verified customer',
                'verified_purchase' => true,
                'created_at' => $review->created_at,
            ]);

        return response()->json([
            'data' => $reviews,
            'summary' => [
                'average_rating' => round((float) $product->reviews()->avg('rating'), 1),
                'review_count' => (int) $product->reviews()->count(),
                'rating_breakdown' => collect(range(1, 5))->mapWithKeys(fn (int $rating) => [(string) $rating => (int) ($counts[$rating] ?? 0)]),
            ],
        ]);
    }

    public function store(Request $request, int $productId): JsonResponse
    {
        $validated = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'title' => ['required', 'string', 'min:3', 'max:120'],
            'body' => ['required', 'string', 'min:10', 'max:2000'],
        ]);

        $review = DB::transaction(function () use ($request, $productId, $validated) {
            $customer = User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            $product = Product::where('is_published', true)->findOrFail($productId);
            $order = $customer->orders()
                ->whereIn('status', ['delivered', 'refunded'])
                ->whereHas('items', fn ($query) => $query->where('product_id', $product->id))
                ->latest()
                ->first();

            if (! $order) {
                throw ValidationException::withMessages(['review' => ['Only customers with a delivered order for this product can leave a review.']]);
            }

            return ProductReview::updateOrCreate(
                ['product_id' => $product->id, 'user_id' => $customer->id],
                ['order_id' => $order->id, 'rating' => $validated['rating'], 'title' => $validated['title'], 'body' => $validated['body']]
            );
        }, 3);

        return response()->json(['data' => [
            'id' => $review->id,
            'rating' => $review->rating,
            'title' => $review->title,
            'body' => $review->body,
            'customer_name' => 'Verified customer',
            'verified_purchase' => true,
            'created_at' => $review->created_at,
        ]]);
    }
}
