<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Le voyageur principal porte une piece d'identite.
 *
 * Le manifeste de bord l'exige en pratique, et rien dans le schema ne permettait
 * de l'enregistrer. **Deux formes**, parce que le terrain n'a pas tranche : un
 * numero saisi au clavier, qui suffit a une liste d'embarquement, ou une photo,
 * qui permet de verifier. Laquelle est demandee est un reglage de plateforme, pas
 * une donnee de reservation — d'ou deux colonnes plutot qu'une colonne et un type.
 *
 * **Nullables toutes les deux, y compris quand le reglage impose la piece.** Le
 * caractere obligatoire est une regle du moment de la saisie ; le graver dans le
 * schema rendrait irrepresentables les reservations anterieures au reglage, et
 * empecherait de le desactiver un jour sans une nouvelle migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_passengers', function (Blueprint $table) {
            // 50 : une CNI camerounaise en fait une vingtaine, un passeport
            // moins. La marge absorbe les formats etrangers sans inviter a coller
            // autre chose qu'un numero.
            $table->string('id_document_number', 50)->nullable()->after('phone');

            // Le chemin dans le stockage, jamais l'image : le disque est R2 en
            // production, et une image en base la ferait voyager dans chaque
            // sauvegarde.
            $table->string('id_document_path', 255)->nullable()->after('id_document_number');
        });

        /*
         * Une piece est un **numero ou une image**, jamais les deux a la fois : le
         * reglage n'en active qu'une, et accepter les deux laisserait deux sources
         * de verite pour une meme identite — dont on ne saurait laquelle fait foi
         * au controle.
         */
        DB::statement(<<<'SQL'
            alter table booking_passengers
            add constraint booking_passengers_one_id_document check (
                id_document_number is null or id_document_path is null
            )
        SQL);
    }

    public function down(): void
    {
        DB::statement('alter table booking_passengers drop constraint if exists booking_passengers_one_id_document');

        Schema::table('booking_passengers', function (Blueprint $table) {
            $table->dropColumn(['id_document_number', 'id_document_path']);
        });
    }
};
