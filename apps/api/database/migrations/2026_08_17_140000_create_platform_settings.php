<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Les reglages de la plateforme, modifiables sans deploiement.
 *
 * Le premier est le taux de commission d'une course (E4 bis) : contrairement aux
 * agences, qui negocient leurs conditions ([B4](../../docs/BRIEF.md)), un
 * chauffeur independant ne negocie pas — un taux unique s'applique, et il doit
 * pouvoir bouger depuis le dashboard plutot que par une mise en production.
 *
 * Cle/valeur plutot qu'une colonne par reglage : chaque nouveau parametre
 * commercial demanderait sinon une migration, et c'est ce qui pousse a les
 * laisser en dur dans le code.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 64)->unique();

            // Chaine : la valeur est interpretee par l'accesseur typé, qui
            // connait ses bornes. Une colonne entiere fermerait la porte au
            // premier reglage qui ne l'est pas.
            $table->string('value', 255);

            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 1000 points de base = 10 %. Les pourcentages sont en points de base
        // partout dans le projet, pour ne jamais arrondir un centime.
        DB::table('platform_settings')->insert([
            'key' => 'rides.commission_bps',
            'value' => '1000',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_settings');
    }
};
