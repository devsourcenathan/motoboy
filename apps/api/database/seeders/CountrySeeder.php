<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Données de référence — exécutable en production.
 *
 * Le Cameroun est la seule zone de lancement (§2 du brief). La table
 * `countries` existe malgré le MVP mono-pays parce que son ajout a posteriori
 * coûterait une migration sur des données en production, alors que sa présence
 * coûte une table : le critère n'est pas « en aura-t-on besoin » mais « combien
 * coûtera le rattrapage » (§1 du standard de code).
 */
final class CountrySeeder extends Seeder
{
    public function run(): void
    {
        DB::table('countries')->upsert(
            [[
                'code' => 'CM',
                'name' => 'Cameroun',
                'currency' => 'XAF',
                'phone_prefix' => '+237',
                'timezone' => 'Africa/Douala',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]],
            uniqueBy: ['code'],
            update: ['name', 'currency', 'phone_prefix', 'timezone', 'updated_at'],
        );
    }
}
