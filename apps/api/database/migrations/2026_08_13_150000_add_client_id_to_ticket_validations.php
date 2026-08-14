<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Identifiant local de la validation, tel que produit par l'appareil de l'agent.
 *
 * **Il distingue un renvoi d'une anomalie.** B3 décide qu'une double validation
 * hors ligne est signalée et non bloquée : deux agents ont scanné le même
 * billet, c'est une anomalie à remonter. Mais un appareil qui synchronise, perd
 * la réponse et resynchronise n'est pas dans ce cas — c'est le même geste,
 * réémis.
 *
 * Sans cette colonne, les deux se confondent : chaque perte de réponse
 * fabriquerait un faux doublon, et la statistique censée révéler un vrai
 * problème d'exploitation deviendrait du bruit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ticket_validations', function (Blueprint $table) {
            $table->string('client_id', 100)->nullable()->after('device_id');

            // Nullable des deux côtés : une validation enregistrée en ligne, par
            // la saisie manuelle de secours, n'a ni appareil ni file locale.
            $table->unique(['device_id', 'client_id']);
        });
    }

    public function down(): void
    {
        Schema::table('ticket_validations', function (Blueprint $table) {
            $table->dropUnique(['device_id', 'client_id']);
            $table->dropColumn('client_id');
        });
    }
};
