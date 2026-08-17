<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Le reversement cesse d'exiger une agence.
 *
 * Fin de la generalisation commencee a l'etape 1. `payouts.payee_id` existe deja et
 * est obligatoire ; ce qui bloquait etait `agency_id`, reste obligatoire lui aussi.
 * Un chauffeur n'a pas d'agence, donc rien ne pouvait lui etre verse quel que soit
 * son solde. C'est le dernier maillon.
 *
 * Le releve suit : une ligne de reversement portait forcement une **reservation**,
 * alors qu'un chauffeur n'en a aucune — il a des courses. Les deux cohabitent,
 * exclusives l'une de l'autre, garanties par la base plutot que par le code
 * appelant.
 */
return new class extends Migration
{
    public function up(): void
    {
        /*
         * Exprime en Blueprint et non en SQL brut : l'analyse statique lit le
         * schema dans les migrations, et un `DB::statement` lui est invisible. Elle
         * continuerait de croire la colonne obligatoire, ce qui rendrait inutiles
         * les controles de nullite ecrits autour.
         */
        Schema::table('payouts', function (Blueprint $table) {
            $table->foreignId('agency_id')->nullable()->change();
        });

        Schema::table('payout_lines', function (Blueprint $table) {
            $table->foreignId('ride_id')->nullable()->after('booking_id')->constrained();
            $table->foreignId('booking_id')->nullable()->change();
        });

        /*
         * Une ligne porte une reservation **ou** une course, jamais les deux ni
         * aucune. Sans cette contrainte, une ligne orpheline serait acceptee et le
         * releve cesserait de justifier son net — or c'est precisement le document
         * qui evite les reclamations repetees sur les montants.
         */
        DB::statement(<<<'SQL'
            alter table payout_lines
            add constraint payout_lines_one_subject check (
                (booking_id is not null and ride_id is null)
                or (booking_id is null and ride_id is not null)
            )
        SQL);

        /*
         * L'unicite passe en index partiels : la contrainte d'origine portait sur
         * `(payout_id, booking_id)`, et une colonne nulle echappe a l'unicite en
         * SQL. Deux lignes de course sur la meme course seraient donc passees.
         */
        DB::statement('alter table payout_lines drop constraint if exists payout_lines_payout_id_booking_id_unique');
        DB::statement(<<<'SQL'
            create unique index payout_lines_payout_booking_unique
            on payout_lines (payout_id, booking_id)
            where booking_id is not null
        SQL);
        DB::statement(<<<'SQL'
            create unique index payout_lines_payout_ride_unique
            on payout_lines (payout_id, ride_id)
            where ride_id is not null
        SQL);
    }

    public function down(): void
    {
        DB::statement('drop index if exists payout_lines_payout_ride_unique');
        DB::statement('drop index if exists payout_lines_payout_booking_unique');
        DB::statement('alter table payout_lines drop constraint if exists payout_lines_one_subject');

        Schema::table('payout_lines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('ride_id');
            $table->foreignId('booking_id')->nullable(false)->change();
            $table->unique(['payout_id', 'booking_id']);
        });

        // Les reversements de chauffeur doivent avoir disparu pour que la colonne
        // redevienne obligatoire.
        Schema::table('payouts', function (Blueprint $table) {
            $table->foreignId('agency_id')->nullable(false)->change();
        });
    }
};
