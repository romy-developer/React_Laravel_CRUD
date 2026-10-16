<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     */
    public function test_the_application_root_redirects_to_the_frontend(): void
    {
        $response = $this->get('/');

        $response->assertRedirect(config('app.frontend_url'));
    }
}
