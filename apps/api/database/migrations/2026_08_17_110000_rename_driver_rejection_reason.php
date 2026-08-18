<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * `rejection_reason` devient `review_note`.
 *
 * Le motif sert au refus **et** à la suspension : un chauffeur suspendu doit
 * savoir pourquoi autant qu'un chauffeur refusé. Garder le nom `rejection_reason`
 * pour y écrire une suspension aurait été un demi-mensonge dans le schéma, et
 * c'est le genre qui se propage — le prochain lecteur croit que la colonne ne
 * concerne que les refus.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('alter table driver_profiles drop constraint driver_profiles_rejection_has_reason');

        Schema::table('driver_profiles', function ($table) {
            $table->renameColumn('rejection_reason', 'review_note');
        });

        // Refus **et** suspension exigent leur motif : les deux retirent un
        // droit, et un chauffeur qui ne sait pas quoi corriger est perdu.
        DB::statement(<<<'SQL'
            alter table driver_profiles add constraint driver_profiles_refusal_has_note check (
                status not in ('REJECTED', 'SUSPENDED') or review_note is not null
            )
        SQL);
    }

    public function down(): void
    {
        DB::statement('alter table driver_profiles drop constraint driver_profiles_refusal_has_note');

        Schema::table('driver_profiles', function ($table) {
            $table->renameColumn('review_note', 'rejection_reason');
        });

        DB::statement(<<<'SQL'
            alter table driver_profiles add constraint driver_profiles_rejection_has_reason check (
                status <> 'REJECTED' or rejection_reason is not null
            )
        SQL);
    }
};
