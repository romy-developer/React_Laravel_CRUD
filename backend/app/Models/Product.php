<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'sku',
        'category',
        'condition',
        'description',
        'image_path',
        'price',
        'compare_at_price',
        'quantity',
        'is_published',
        'is_featured',
    ];

    protected $appends = ['image_url'];

    protected function casts(): array
    {
        return ['is_published' => 'boolean', 'is_featured' => 'boolean'];
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('sort_order')->orderBy('id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class);
    }

    public function getImageUrlAttribute(): ?string
    {
        $path = $this->image_path ?: $this->images()->value('image_path');
        return $path ? url(Storage::disk('public')->url($path)) : null;
    }

    public function inventoryMovements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }
}
