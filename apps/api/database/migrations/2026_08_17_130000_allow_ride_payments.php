<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Un paiement peut porter sur une course, pas seulement sur une réservation.
 *
 * `payments.booking_id` était obligatoire : un appel de service n'a pas de
 * réservation, et le prix se paie à l'acceptation d'une offre
 * ([E4 bis](../../docs/BRIEF.md)).
 *
 * **Deux colonnes et une contrainte, plutôt qu'une relation polymorphe.** Comme
 * pour les bénéficiaires, la clé étrangère est la dernière garantie qu'on lâche
 * sur du code d'argent. La contrainte impose qu'exactement une des deux soit
 * renseignée : un paiement qui ne se rattache à rien, ou aux deux, n'est pas
 * représentable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('ride_id')->nullable()->after('booking_id')->constrained();
        });

        // Rendue optionnelle : c'est la contrainte ci-dessous qui garantit
        // désormais qu'un paiement a bien un objet.
        DB::statement('alter table payments alter column booking_id drop not null');

        DB::statement(<<<'SQL'
            alter table payments add constraint payments_belong_to_one_subject check (
                (booking_id is not null and ride_id is null)
                or (booking_id is null and ride_id is not null)
            )
        SQL);

        Schema::table('driver_profiles', function (Blueprint $table) {
            /*
             * Combien de fois ce chauffeur ne s'est pas présenté.
             *
             * Le remboursement seul n'empêche pas la récidive, et sans agence
             * derrière lui c'est la réputation de la plateforme qui s'use. Ce
             * compteur est la matière d'une suspension : il ne se remet pas à
             * zéro tout seul.
             */
            $table->unsignedSmallInteger('no_show_count')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('driver_profiles', function (Blueprint $table) {
            $table->dropColumn('no_show_count');
        });

        DB::statement('alter table payments drop constraint payments_belong_to_one_subject');

        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('ride_id');
        });

        // Les paiements de course doivent avoir disparu pour que la colonne
        // redevienne obligatoire.
        DB::statement('alter table payments alter column booking_id set not null');
    }
};
