<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProductController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => Product::query()->latest()->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());
        $image = $validated['image'] ?? null;
        unset($validated['image'], $validated['remove_image']);

        if ($image instanceof UploadedFile) {
            $validated['image_path'] = $image->store('products', 'public');
        }

        $product = Product::create($validated);

        return response()->json([
            'message' => 'Product created successfully.',
            'data' => $product,
        ], 201);
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json(['data' => $product]);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate($this->rules());
        $image = $validated['image'] ?? null;
        $removeImage = (bool) ($validated['remove_image'] ?? false);
        unset($validated['image'], $validated['remove_image']);

        if ($image instanceof UploadedFile) {
            $newImagePath = $image->store('products', 'public');
            if ($product->image_path) {
                Storage::disk('public')->delete($product->image_path);
            }
            $validated['image_path'] = $newImagePath;
        } elseif ($removeImage && $product->image_path) {
            Storage::disk('public')->delete($product->image_path);
            $validated['image_path'] = null;
        }

        $product->update($validated);

        return response()->json([
            'message' => 'Product updated successfully.',
            'data' => $product->refresh(),
        ]);
    }

    public function destroy(Product $product): JsonResponse
    {
        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }
        $product->delete();

        return response()->json(['message' => 'Product deleted successfully.']);
    }

    private function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'in:Electronics,Clothing,Home & Kitchen,Books,Other'],
            'condition' => ['required', 'string', 'in:New,Used,Refurbished'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'quantity' => ['required', 'integer', 'min:0'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'remove_image' => ['nullable', 'boolean'],
        ];
    }
}
