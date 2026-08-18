<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Le compte de versement cesse d'appartenir a une agence.
 *
 * Derniere piece agence-forme du circuit d'argent : les ecritures et les
 * reversements pointent deja un beneficiaire, mais la **destination** du virement
 * restait indexee sur `agency_id`. Un chauffeur independant n'a pas d'agence, donc
 * pas de compte — et rien ne pouvait lui etre verse.
 *
 * La table est **renommee**, pas seulement completee : `agency_payout_accounts`
 * aurait continue d'affirmer le contraire de ce qu'elle contient, et c'est le
 * genre de demi-mensonge qui se propage au prochain lecteur.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('agency_payout_accounts', 'payout_accounts');

        Schema::table('payout_accounts', function (Blueprint $table) {
            $table->foreignId('payee_id')->nullable()->after('id')->constrained();
        });

        // Reprise : chaque compte existant rejoint le beneficiaire de son agence.
        DB::statement(<<<'SQL'
            update payout_accounts as a
            set payee_id = p.id
            from payees as p
            where p.agency_id = a.agency_id
        SQL);

        Schema::table('payout_accounts', function (Blueprint $table) {
            // Renseigne partout : un compte sans beneficiaire cesse d'etre
            // representable, comme une ecriture sans destinataire.
            $table->foreignId('payee_id')->nullable(false)->change();

            // L'agence devient une precision, la ou elle s'applique.
            $table->foreignId('agency_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('payout_accounts', function (Blueprint $table) {
            $table->foreignId('agency_id')->nullable(false)->change();
            $table->dropConstrainedForeignId('payee_id');
        });

        Schema::rename('payout_accounts', 'agency_payout_accounts');
    }
};
