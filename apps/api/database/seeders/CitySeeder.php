<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Villes du référentiel — exécutable en production.
 *
 * Les villes forment une **liste fermée curée par MOTOBOY** (B1 du brief) : si
 * chaque agence pouvait créer la sienne, « Douala », « douala » et « Dla »
 * coexisteraient et la recherche cesserait de regrouper les offres.
 *
 * ⚠️ **Cette liste doit être validée sur le terrain avant le lancement.** Elle
 * couvre les dix chefs-lieux de région et des villes secondaires desservies par
 * le transport interurbain, mais elle n'a pas d'autorité : des axes réels
 * peuvent manquer, et certaines villes retenues peuvent n'avoir aucun trafic.
 *
 * Le circuit de demande d'ajout par les agences (`city_requests`) existe
 * précisément pour combler les manques sans bloquer une agence.
 */
final class CitySeeder extends Seeder
{
    /**
     * Chefs-lieux de région en premier, puis villes secondaires.
     *
     * @var list<string>
     */
    private const CITIES = [
        // Chefs-lieux des dix régions
        'Douala',
        'Yaoundé',
        'Bafoussam',
        'Bamenda',
        'Buea',
        'Garoua',
        'Maroua',
        'Ngaoundéré',
        'Bertoua',
        'Ebolowa',

        // Villes secondaires desservies par l'interurbain
        'Limbe',
        'Kumba',
        'Tiko',
        'Kribi',
        'Edéa',
        'Nkongsamba',
        'Dschang',
        'Foumban',
        'Bafang',
        'Mbouda',
        'Kumbo',
        'Sangmélima',
        'Mbalmayo',
        'Bafia',
        'Guider',
        'Kousséri',
    ];

    /**
     * Formes courtes réellement employées. Les variantes sans accent sont
     * générées automatiquement et n'ont pas à figurer ici.
     *
     * @var array<string, list<string>>
     */
    private const SHORT_FORMS = [
        'Yaoundé' => ['Yde'],
        'Douala' => ['Dla'],
    ];

    public function run(): void
    {
        $countryId = DB::table('countries')->where('code', 'CM')->value('id');

        if ($countryId === null) {
            throw new \RuntimeException('CountrySeeder doit être exécuté avant CitySeeder.');
        }

        foreach (self::CITIES as $name) {
            $slug = Str::slug($name);

            DB::table('cities')->upsert(
                [[
                    'country_id' => $countryId,
                    'name' => $name,
                    'slug' => $slug,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]],
                uniqueBy: ['country_id', 'slug'],
                update: ['name', 'updated_at'],
            );

            $cityId = DB::table('cities')
                ->where('country_id', $countryId)
                ->where('slug', $slug)
                ->value('id');

            $this->seedAliases((int) $cityId, $name);
        }
    }

    /**
     * Les accents ne sont pratiquement jamais saisis sur un clavier de
     * téléphone : sans forme normalisée, l'autocomplétion échoue sur une grande
     * part des saisies réelles (B1).
     */
    private function seedAliases(int $cityId, string $name): void
    {
        $aliases = self::SHORT_FORMS[$name] ?? [];

        // La forme sans accent n'est un alias que si elle diffère du nom.
        $stripped = Str::ascii($name);
        if ($stripped !== $name) {
            $aliases[] = $stripped;
        }

        foreach ($aliases as $alias) {
            DB::table('city_aliases')->upsert(
                [[
                    'city_id' => $cityId,
                    'alias' => $alias,
                    'normalized' => Str::lower(Str::ascii($alias)),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]],
                uniqueBy: ['city_id', 'normalized'],
                update: ['alias', 'updated_at'],
            );
        }
    }
}
