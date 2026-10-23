<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class ProductImage extends Model
{
    protected $fillable = ['image_path', 'alt_text', 'sort_order'];

    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): string
    {
        return url(Storage::disk('public')->url($this->image_path));
    }
}
