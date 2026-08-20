<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Places\Models\Country;
use Database\Seeders\CountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Ce que le client doit savoir avant d'afficher un formulaire.
 *
 * Cet endpoint est public et volontairement pauvre. Les tests protegent donc les
 * deux choses qui, en s'y glissant, le rendraient faux : une fuite de reglage
 * reserve, et un pays ou l'on ne vend pas.
 */
final class ClientConfigTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Le referentiel geographique vient d'un seeder, pas d'une migration :
        // sans lui, l'endpoint rend une liste vide et le test le confondrait avec
        // une regression.
        $this->seed(CountrySeeder::class);
    }

    public function test_it_answers_without_a_session(): void
    {
        $response = $this->getJson('/api/v1/config');

        $response->assertOk();
        $response->assertJsonStructure(['id_document_mode', 'id_document_required', 'countries']);
    }

    /**
     * **Les pays y figurent parce qu'aucun formulaire ne peut s'afficher sans
     * eux.** Une agence qui reclame une ville absente doit dire de quel pays elle
     * releve ; rien d'autre n'expose cette liste, et l'ecrire en dur cote client
     * rattacherait silencieusement les demandes au mauvais pays des le second.
     */
    public function test_it_names_the_countries_a_form_needs(): void
    {
        $response = $this->getJson('/api/v1/config');

        $countries = $response->json('countries');

        $this->assertIsArray($countries);
        $this->assertNotEmpty($countries, 'Sans pays, la demande de ville est insaisissable.');
        $this->assertSame(
            ['id', 'code', 'name'],
            array_keys($countries[0]),
            'Trois champs et pas un de plus : cet endpoint est public.',
        );
    }

    /**
     * Proposer un pays ou l'on ne vend pas ferait deposer une demande que personne
     * n'accepterait — et l'agence attendrait une reponse qui ne viendrait jamais.
     */
    public function test_it_hides_a_country_that_is_not_served(): void
    {
        Country::query()->create([
            'code' => 'ZZ',
            'name' => 'Pays fermé',
            'currency' => 'XAF',
            'phone_prefix' => '+999',
            'timezone' => 'UTC',
            'is_active' => false,
        ]);

        $codes = array_column($this->getJson('/api/v1/config')->json('countries'), 'code');

        $this->assertNotContains('ZZ', $codes);
    }
}
