<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();

            // Référence publique, lisible et non devinable. Elle figure sur le
            // billet, sert de secours à la saisie manuelle à l'embarquement et
            // se dicte au téléphone. Un identifiant séquentiel visible
            // révélerait le volume d'affaires.
            $table->string('reference', 20)->unique();

            $table->foreignId('trip_id')->constrained()->restrictOnDelete();

            // Dénormalisé pour le filtrage RBAC.
            $table->foreignId('agency_id')->constrained()->restrictOnDelete();

            // Null en vente au guichet : le passager n'a pas de compte, nom et
            // téléphone suffisent — c'est une vente au comptoir, pas un tunnel
            // de conversion (I2).
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->string('channel', 15)->default('ONLINE');

            // L'agent, en vente au guichet.
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->string('status', 30);

            // Échéance de la tenue des places. Renseignée tant que la
            // réservation est en PENDING_PAYMENT.
            $table->timestampTz('expires_at')->nullable();

            $table->smallInteger('seats_count');
            $table->bigInteger('total_amount');
            $table->char('currency', 3)->default('XAF');

            $table->string('contact_name', 150)->nullable();
            $table->string('contact_phone', 20)->nullable();

            /*
             * Conditions figées à la création (B4 et B5).
             *
             * Aucun calcul financier ne doit lire les paramètres courants de
             * l'agence : sans ce figement, modifier un taux de commission
             * réécrirait rétroactivement l'historique de toutes les réservations
             * passées, y compris celles déjà reversées et déjà justifiées à
             * l'agence par un relevé.
             *
             * Colonnes explicites plutôt qu'un instantané JSON : les
             * reversements et les statistiques agrègent et filtrent sur ces
             * valeurs, ce qui est impraticable en JSON.
             */
            $table->string('commission_type', 15);
            $table->bigInteger('commission_value');
            $table->string('fee_bearer', 15);
            $table->smallInteger('cancellation_deadline_hours');
            $table->string('cancellation_fee_type', 15);
            $table->bigInteger('cancellation_fee_value');

            $table->timestampTz('confirmed_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('cancellation_reason', 30)->nullable();

            $table->timestampsTz();

            // Job de libération des tenues expirées.
            $table->index(['status', 'expires_at']);
            $table->index(['trip_id', 'status']);
            $table->index(['user_id', 'created_at']);
        });

        /*
         * Un passager, un siège, un billet.
         *
         * Le grain du passager est nécessaire à l'annulation partielle — trois
         * places réservées, une annulée (B5).
         */
        Schema::create('booking_passengers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();

            // Dénormalisé : l'index unique partiel exige que les deux colonnes
            // vivent dans la même table.
            $table->foreignId('trip_id')->constrained()->restrictOnDelete();

            // Null en mode CAPACITY.
            $table->foreignId('seat_id')->nullable()->constrained('vehicle_seats')->restrictOnDelete();

            // Invariant : vrai si et seulement si la réservation est en
            // PENDING_PAYMENT ou CONFIRMED **et** le passager est ACTIVE.
            // Maintenu dans la même transaction que le statut de la
            // réservation. C'est la seule règle du schéma que la base ne
            // garantit pas seule.
            $table->boolean('holds_seat')->default(true);

            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('phone', 20)->nullable();
            $table->string('status', 20)->default('ACTIVE');
            $table->timestampsTz();
        });

        /*
         * La pièce maîtresse de B2, et elle remplace le verrou explicite en mode
         * SEATED : **l'index unique _est_ la sérialisation**. Deux réservations
         * concurrentes du même siège entrent en conflit au niveau de l'index,
         * l'une passe, l'autre échoue proprement — et l'application traite la
         * violation comme un cas nominal, pas comme une panne.
         *
         * Ce choix évite aussi de matérialiser une ligne par siège et par
         * départ : de l'ordre de 12 600 lignes par liaison et par mois, dont la
         * quasi-totalité ne serait jamais vendue.
         *
         * Le prédicat ne peut pas inclure `now()` — PostgreSQL exige une
         * expression immuable. Une tenue expirée reste donc bloquante jusqu'au
         * passage du job de libération, d'où une minute d'indisponibilité
         * fantôme au maximum, explicitement acceptée.
         */
        DB::statement(<<<'SQL'
            create unique index booking_passengers_seat_unique
                on booking_passengers (trip_id, seat_id)
                where holds_seat = true
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_passengers');
        Schema::dropIfExists('bookings');
    }
};
