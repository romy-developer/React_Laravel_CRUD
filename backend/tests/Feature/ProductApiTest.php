<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_can_be_created_read_updated_and_deleted(): void
    {
        $createResponse = $this->postJson('/api/products', [
            'name' => 'Field journal',
            'description' => 'A ruled notebook',
            'price' => 12.50,
            'quantity' => 20,
        ]);

        $createResponse->assertCreated()
            ->assertJsonPath('data.name', 'Field journal');

        $productId = $createResponse->json('data.id');

        $this->getJson('/api/products')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/products/{$productId}")
            ->assertOk()
            ->assertJsonPath('data.quantity', 20);

        $this->putJson("/api/products/{$productId}", [
            'name' => 'Field journal, revised',
            'description' => 'A ruled notebook',
            'price' => 14,
            'quantity' => 18,
        ])->assertOk()->assertJsonPath('data.name', 'Field journal, revised');

        $this->deleteJson("/api/products/{$productId}")
            ->assertOk()
            ->assertJsonPath('message', 'Product deleted successfully.');

        $this->getJson("/api/products/{$productId}")->assertNotFound();
    }

    public function test_product_input_is_validated(): void
    {
        $this->postJson('/api/products', [
            'description' => [],
            'price' => -1,
            'quantity' => 1.5,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'description', 'price', 'quantity']);
    }
}