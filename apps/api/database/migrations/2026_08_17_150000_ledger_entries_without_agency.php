<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Une ecriture peut n'avoir aucune agence.
 *
 * Premier pas de la phase de contraction annoncee a l'etape 1 : le grand livre
 * s'indexe desormais sur le beneficiaire, et une course d'appel de service (E4
 * bis) n'a pas d'agence derriere elle.
 *
 * `payee_id` reste obligatoire — c'est lui qui garantit qu'une ecriture a un
 * destinataire. `agency_id` devient une precision, la ou elle s'applique.
 */
return new class extends Migration
{
    public function up(): void
    {
        /*
         * Exprime en Blueprint et non en SQL brut : l'analyse statique lit le
         * schema dans les migrations, et un `DB::statement` lui est invisible.
         * Elle continuerait de croire la colonne obligatoire, ce qui rendrait
         * inutiles tous les controles de nullite ecrits autour.
         */
        Schema::table('agency_ledger_entries', function (Blueprint $table) {
            $table->foreignId('agency_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Les ecritures de course doivent avoir disparu pour que la colonne
        // redevienne obligatoire.
        Schema::table('agency_ledger_entries', function (Blueprint $table) {
            $table->foreignId('agency_id')->nullable(false)->change();
        });
    }
};
