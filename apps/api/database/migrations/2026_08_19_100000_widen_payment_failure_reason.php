<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cent caracteres ne suffisaient pas au motif d'echec d'un paiement.
 *
 * Le motif vient du prestataire, et sa longueur ne nous appartient pas :
 * « Agregateur injoignable : cURL error 28: Operation timed out after 20001
 * milliseconds… » depasse a lui seul la borne. PostgreSQL refusait alors
 * l'ecriture, et un refus de paiement — le cas le plus banal en Mobile Money —
 * remontait en 500. C'est arrive en production le 19 aout 2026.
 *
 * Le modele borne desormais la valeur avant l'ecriture, donc plus rien ne peut
 * deborder. Cette colonne s'aligne malgre tout sur celle des reversements, qui
 * tenait deja 255 : un motif tronque a cent caracteres coupe au milieu de la
 * phrase qui explique l'echec.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->string('failure_reason', 255)->nullable()->change();
        });
    }

    public function down(): void
    {
        /*
         * Le retour tronque ce qui depasse : sans cela, PostgreSQL refuserait de
         * retrecir une colonne contenant des valeurs plus longues, et la
         * migration inverse echouerait sur une base reelle.
         */
        DB::statement(
            'UPDATE payments SET failure_reason = LEFT(failure_reason, 100)'
            .' WHERE LENGTH(failure_reason) > 100'
        );

        Schema::table('payments', function (Blueprint $table): void {
            $table->string('failure_reason', 100)->nullable()->change();
        });
    }
};
