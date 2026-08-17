<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Le bénéficiaire d'un reversement.
 *
 * Jusqu'ici, le seul point de sortie d'argent de la plateforme était indexé sur
 * `agency_id` : le grand livre, les reversements, l'éligibilité. L'appel de
 * service ([Partie IV du brief](../../docs/BRIEF.md)) paie des **personnes**, et
 * il n'y a pas d'agence derrière un chauffeur indépendant.
 *
 * **Une table plutôt qu'une relation polymorphe.** `payee_type` + `payee_id`
 * aurait supprimé les clés étrangères, et sur du code d'argent c'est la dernière
 * garantie qu'on veut lâcher. Ici, `payees` porte une vraie contrainte vers
 * l'agence ou vers l'utilisateur, et le grand livre cesse de savoir de quoi il
 * s'agit.
 *
 * **Phase d'expansion.** `agency_id` reste en place et reste renseigné : les
 * lectures existantes continuent de fonctionner à l'identique. Le retrait de la
 * colonne viendra quand tout lira `payee_id` — le faire d'un bloc rendrait ce
 * changement irréversible en cas d'erreur, sur les tables les moins réversibles
 * du projet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payees', function (Blueprint $table) {
            $table->id();

            /*
             * `AGENCY` ou `DRIVER`. Le type est explicite plutôt que déduit de
             * la colonne renseignée : une ligne sans agence **ni** utilisateur
             * serait sinon un bénéficiaire d'un genre inconnu, et le contrôle
             * ci-dessous ne saurait pas quoi refuser.
             */
            $table->string('kind', 16);

            $table->foreignId('agency_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();

            $table->timestamps();

            // Une agence n'a qu'un bénéficiaire, un chauffeur aussi : sans ça,
            // un second reversement pourrait naître sur un second bénéficiaire
            // et scinder un solde en deux.
            $table->unique('agency_id');
            $table->unique('user_id');
        });

        /*
         * Le genre décide de la colonne renseignée, et une seule l'est. Porté
         * par la base : c'est l'invariant dont dépend le fait qu'un solde ait un
         * destinataire, et la logique applicative n'est pas un endroit sûr pour
         * le garantir.
         */
        DB::statement(<<<'SQL'
            alter table payees add constraint payees_kind_matches_target check (
                (kind = 'AGENCY' and agency_id is not null and user_id is null)
                or (kind = 'DRIVER' and user_id is not null and agency_id is null)
            )
        SQL);

        // Chaque agence existante devient un bénéficiaire. Sans cette reprise,
        // les écritures déjà au grand livre n'auraient personne à qui être
        // payées.
        DB::statement(<<<'SQL'
            insert into payees (kind, agency_id, created_at, updated_at)
            select 'AGENCY', id, now(), now() from agencies
        SQL);

        Schema::table('agency_ledger_entries', function (Blueprint $table) {
            $table->foreignId('payee_id')->nullable()->after('agency_id')->constrained();
        });

        Schema::table('payouts', function (Blueprint $table) {
            $table->foreignId('payee_id')->nullable()->after('agency_id')->constrained();
        });

        foreach (['agency_ledger_entries', 'payouts'] as $table) {
            DB::statement(<<<SQL
                update {$table} as t
                set payee_id = p.id
                from payees as p
                where p.agency_id = t.agency_id
            SQL);
        }

        // Renseignée partout : la colonne peut devenir obligatoire, et un
        // reversement sans bénéficiaire cesse d'être représentable.
        foreach (['agency_ledger_entries', 'payouts'] as $table) {
            DB::statement("alter table {$table} alter column payee_id set not null");
        }
    }

    public function down(): void
    {
        foreach (['agency_ledger_entries', 'payouts'] as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->dropConstrainedForeignId('payee_id');
            });
        }

        Schema::dropIfExists('payees');
    }
};
