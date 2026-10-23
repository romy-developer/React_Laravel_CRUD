<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\AdminAuditLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function storefront(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'category' => ['nullable', 'string', Rule::in(['Electronics', 'Clothing', 'Home & Kitchen', 'Books', 'Other'])],
            'min_price' => ['nullable', 'numeric', 'min:0'],
            'max_price' => ['nullable', 'numeric', 'min:0', 'gte:min_price'],
            'availability' => ['nullable', Rule::in(['in_stock', 'all'])],
            'sort' => ['nullable', Rule::in(['newest', 'price_asc', 'price_desc', 'name'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $products = Product::query()->with('images')->withAvg('reviews', 'rating')->withCount('reviews')
            ->where('is_published', true)
            ->when($filters['search'] ?? null, function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%");
                });
            })
            ->when($filters['category'] ?? null, fn ($query, $category) => $query->where('category', $category))
            ->when(isset($filters['min_price']), fn ($query) => $query->where('price', '>=', $filters['min_price']))
            ->when(isset($filters['max_price']), fn ($query) => $query->where('price', '<=', $filters['max_price']))
            ->when(($filters['availability'] ?? null) === 'in_stock', fn ($query) => $query->where('quantity', '>', 0))
            ->when(($filters['sort'] ?? 'newest') === 'price_asc', fn ($query) => $query->orderBy('price'))
            ->when(($filters['sort'] ?? 'newest') === 'price_desc', fn ($query) => $query->orderByDesc('price'))
            ->when(($filters['sort'] ?? 'newest') === 'name', fn ($query) => $query->orderBy('name'))
            ->when(($filters['sort'] ?? 'newest') === 'newest', fn ($query) => $query->latest())
            ->paginate(12)
            ->withQueryString();

        return response()->json($products);
    }

    public function storefrontShow(int $productId): JsonResponse
    {
        $product = Product::with('images')->withAvg('reviews', 'rating')->withCount('reviews')->where('is_published', true)->findOrFail($productId);
        $related = Product::with('images')->withAvg('reviews', 'rating')->withCount('reviews')->where('is_published', true)
            ->where('id', '<>', $product->id)
            ->where('category', $product->category)
            ->latest()
            ->limit(4)
            ->get();

        return response()->json(['data' => ['product' => $product, 'related' => $related]]);
    }

    public function featured(): JsonResponse
    {
        $products = Product::with('images')->withAvg('reviews', 'rating')->withCount('reviews')
            ->where('is_published', true)
            ->where('quantity', '>', 0)
            ->where('is_featured', true)
            ->latest()
            ->limit(4)
            ->get();

        if ($products->isEmpty()) {
            $products = Product::with('images')->withAvg('reviews', 'rating')->withCount('reviews')
                ->where('is_published', true)
                ->where('quantity', '>', 0)
                ->latest()
                ->limit(4)
                ->get();
        }

        return response()->json(['data' => $products]);
    }

    public function index(): JsonResponse
    {
        return response()->json(['data' => Product::query()->with('images')->latest()->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());
        $image = $validated['image'] ?? null;
        unset($validated['image'], $validated['remove_image']);

        if ($image instanceof UploadedFile) {
            $validated['image_path'] = $image->store('products', 'public');
        }

        $product = DB::transaction(function () use ($validated, $request) {
            $product = Product::create($validated);
            $product->inventoryMovements()->create([
                'product_name' => $product->name,
                'product_sku' => $product->sku,
                'actor_user_id' => $request->user()->id,
                'actor_type' => 'admin',
                'quantity_delta' => (int) $product->quantity,
                'reason' => 'opening_balance',
                'note' => 'Initial stock set when product was created.',
            ]);
            AdminAuditLog::record(
                $request->user(), 'product.created', 'product', (int) $product->id, $product->name,
                "Created product {$product->name}.", ['fields' => array_keys($validated), 'published' => (bool) $product->is_published]
            );
            return $product;
        });

        $this->saveGalleryImages($product, $request);
        $product->load('images');

        return response()->json([
            'message' => 'Product created successfully.',
            'data' => $product->load('images'),
        ], 201);
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json(['data' => $product->load('images')]);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate($this->rules($product));
        $image = $validated['image'] ?? null;
        $removeImage = (bool) ($validated['remove_image'] ?? false);
        $removeImageIds = $validated['remove_image_ids'] ?? [];
        unset($validated['image'], $validated['remove_image'], $validated['images'], $validated['remove_image_ids']);

        $oldImagePath = $product->image_path;
        $newImagePath = null;
        if ($image instanceof UploadedFile) {
            $newImagePath = $image->store('products', 'public');
            $validated['image_path'] = $newImagePath;
        } elseif ($removeImage && $product->image_path) {
            $validated['image_path'] = null;
        }

        try {
            $product = DB::transaction(function () use ($product, $validated, $request) {
                $locked = Product::whereKey($product->id)->lockForUpdate()->firstOrFail();
                $oldQuantity = (int) $locked->quantity;
                $oldName = $locked->name;
                $locked->update($validated);
                $delta = (int) $locked->quantity - $oldQuantity;
                if ($delta !== 0) {
                    $locked->inventoryMovements()->create([
                        'product_name' => $locked->name,
                        'product_sku' => $locked->sku,
                        'actor_user_id' => $request->user()->id,
                        'actor_type' => 'admin',
                        'quantity_delta' => $delta,
                        'reason' => 'stock_adjustment',
                        'note' => "Stock changed from {$oldQuantity} to {$locked->quantity} by an administrator.",
                    ]);
                }
                AdminAuditLog::record(
                    $request->user(), 'product.updated', 'product', (int) $locked->id, $locked->name,
                    "Updated product {$oldName}; changed fields: ".implode(', ', array_keys($validated)).'.',
                    ['fields' => array_keys($validated), 'quantity_delta' => $delta]
                );
                return $locked->refresh();
            }, 3);
        } catch (\Throwable $exception) {
            if ($newImagePath) Storage::disk('public')->delete($newImagePath);
            throw $exception;
        }

        if ($oldImagePath && ($newImagePath || $removeImage)) {
            $product->images()->where('image_path', $oldImagePath)->delete();
            Storage::disk('public')->delete($oldImagePath);
        }

        if ($removeImageIds) {
            $images = $product->images()->whereIn('id', $removeImageIds)->get();
            $removedPrimaryPath = $product->image_path;
            $removedPrimary = $images->contains('image_path', $product->image_path);
            foreach ($images as $galleryImage) {
                if ($galleryImage->image_path !== $product->image_path) Storage::disk('public')->delete($galleryImage->image_path);
                $galleryImage->delete();
            }
            if ($removedPrimary) {
                $nextImage = $product->images()->first();
                $product->update(['image_path' => $nextImage?->image_path]);
                if ($removedPrimaryPath && !$product->images()->where('image_path', $removedPrimaryPath)->exists()) {
                    Storage::disk('public')->delete($removedPrimaryPath);
                }
            }
        }
        $this->saveGalleryImages($product, $request);

        return response()->json([
            'message' => 'Product updated successfully.',
            'data' => $product->refresh()->load('images'),
        ]);
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        $imagePath = $product->image_path;
        $galleryPaths = $product->images()->pluck('image_path')->all();
        DB::transaction(function () use ($request, $product) {
            $locked = Product::whereKey($product->id)->lockForUpdate()->firstOrFail();
            if ($locked->quantity > 0) {
                $locked->inventoryMovements()->create([
                    'product_name' => $locked->name,
                    'product_sku' => $locked->sku,
                    'actor_user_id' => $request->user()->id,
                    'actor_type' => 'admin',
                    'quantity_delta' => -((int) $locked->quantity),
                    'reason' => 'product_deleted',
                    'note' => 'Remaining stock removed when product was deleted.',
                ]);
            }
            AdminAuditLog::record(
                $request->user(), 'product.deleted', 'product', (int) $locked->id, $locked->name,
                "Deleted product {$locked->name}.", ['removed_stock' => (int) $locked->quantity]
            );
            $locked->delete();
        }, 3);

        if ($imagePath) Storage::disk('public')->delete($imagePath);
        foreach (array_unique($galleryPaths) as $path) Storage::disk('public')->delete($path);

        return response()->json(['message' => 'Product deleted successfully.']);
    }

    private function rules(?Product $product = null): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['nullable', 'string', 'max:64', Rule::unique('products', 'sku')->ignore($product?->id)],
            'category' => ['required', 'string', 'in:Electronics,Clothing,Home & Kitchen,Books,Other'],
            'condition' => ['required', 'string', 'in:New,Used,Refurbished'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'compare_at_price' => ['nullable', 'numeric', 'gt:price'],
            'quantity' => ['required', 'integer', 'min:0'],
            'is_published' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'remove_image' => ['nullable', 'boolean'],
            'images' => ['sometimes', 'array', 'max:10'],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'remove_image_ids' => ['sometimes', 'array'],
            'remove_image_ids.*' => ['integer', 'distinct', 'exists:product_images,id'],
        ];
    }

    private function saveGalleryImages(Product $product, Request $request): void
    {
        if ($product->image_path && !$product->images()->where('image_path', $product->image_path)->exists()) {
            $product->images()->create([
                'image_path' => $product->image_path,
                'alt_text' => $product->name,
                'sort_order' => 0,
            ]);
        }
        $sortOrder = (int) $product->images()->max('sort_order') + 1;
        foreach ($request->file('images', []) as $file) {
            $path = $file->store('products', 'public');
            $product->images()->create([
                'image_path' => $path,
                'alt_text' => $product->name,
                'sort_order' => $sortOrder++,
            ]);
        }

        if (!$product->image_path) {
            $first = $product->images()->first();
            if ($first) $product->update(['image_path' => $first->image_path]);
        }
    }
}
