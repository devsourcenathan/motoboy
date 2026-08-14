<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Référentiel géographique (B1 du brief).
 *
 * Les villes forment une **liste fermée curée par MOTOBOY** : si chaque agence
 * pouvait créer la sienne, « Douala », « douala » et « Dla » coexisteraient et
 * la recherche cesserait de regrouper les offres — le comparateur perdrait son
 * objet. Les gares, elles, sont créées par les agences (migration suivante,
 * elles dépendent de `agencies`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('countries', function (Blueprint $table) {
            $table->id();
            $table->char('code', 2)->unique();
            $table->string('name', 100);
            $table->char('currency', 3);
            $table->string('phone_prefix', 5);
            $table->string('timezone', 50);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        Schema::create('cities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('country_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('slug', 120);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->unique(['country_id', 'slug']);
        });

        // Sans alias ni normalisation, l'autocomplétion échoue sur une grande
        // part des saisies réelles : les accents ne sont pratiquement jamais
        // saisis sur un clavier de téléphone.
        Schema::create('city_aliases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('city_id')->constrained()->cascadeOnDelete();
            $table->string('alias', 120);
            $table->string('normalized', 120)->index();
            $table->timestampsTz();

            $table->unique(['city_id', 'normalized']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('city_aliases');
        Schema::dropIfExists('cities');
        Schema::dropIfExists('countries');
    }
};
