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

    /**
     * Un client qui **n'envoie pas** `Accept: application/json` obtient quand
     * même l'erreur typée du contrat.
     *
     * Sans cette garantie, le middleware d'authentification redirige vers une
     * route `login` qui n'existe pas, et le client reçoit un 500 opaque là où le
     * contrat promet un 401. Les assistants `getJson` posent l'en-tête, ce qui
     * masquait le cas dans tous les autres tests.
     */
    public function test_an_unauthenticated_call_without_a_json_header_still_gets_a_typed_error(): void
    {
        $this->get('/api/v1/me')
            ->assertStatus(401)
            ->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    public function test_the_contract_is_served_as_it_stands(): void
    {
        $spec = $this->get('/openapi.yaml')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/yaml; charset=UTF-8')
            ->getContent();

        // C'est le fichier qui fait foi qui est servi, pas une régénération
        // depuis le code : une documentation dérivée d'autre chose finirait par
        // décrire un produit qui n'existe pas.
        $this->assertIsString($spec);
        $this->assertStringContainsString('openapi: 3.1', $spec);
        $this->assertStringContainsString('/v1/agency/counter-sales', $spec);
    }

    public function test_the_documentation_page_renders(): void
    {
        $this->get('/docs')
            ->assertOk()
            ->assertSee('swagger', false);
    }

    public function test_the_documentation_can_be_closed(): void
    {
        config(['api.docs_enabled' => false]);

        $this->get('/docs')->assertNotFound();
        $this->get('/openapi.yaml')->assertNotFound();
    }

    public function test_the_health_probe_answers(): void
    {
        // C'est ce chemin que l'hébergeur interroge pour décider si le
        // conteneur est vivant : le casser retire le service de la rotation.
        $this->get('/up')->assertOk();
    }
}
