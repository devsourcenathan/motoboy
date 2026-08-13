<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

final class ApiRootTest extends TestCase
{
    public function test_it_identifies_itself_as_an_api(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertJson(['name' => 'MOTOBOY API']);
    }
}
