<?php

namespace App\Http\Controllers;

use App\Models\InventoryMovement;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryMovementController extends Controller
{
    public function index(Request $request, Product $product): JsonResponse
    {
        $filters = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $movements = InventoryMovement::query()
            ->with(['order:id,order_number', 'actor:id,name'])
            ->where('product_reference_id', $product->id)
            ->latest('created_at')
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        return response()->json($movements->through(fn (InventoryMovement $movement) => [
            'id' => $movement->id,
            'product_name' => $movement->product_name,
            'product_sku' => $movement->product_sku,
            'order_number' => $movement->order?->order_number,
            'actor_type' => $movement->actor_type,
            'actor_name' => $movement->actor?->name,
            'quantity_delta' => $movement->quantity_delta,
            'reason' => $movement->reason,
            'note' => $movement->note,
            'created_at' => $movement->created_at,
        ]));
    }
}
