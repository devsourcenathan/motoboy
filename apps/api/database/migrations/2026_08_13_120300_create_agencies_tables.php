<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agencies', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 20)->unique();
            $table->string('name', 150);
            $table->string('legal_name', 200)->nullable();
            $table->string('phone', 20);
            $table->string('email')->nullable();
            $table->string('logo_path')->nullable();

            // Langue des messages envoyés à un passager **sans compte**, en
            // vente au guichet — il n'a pas de `users.locale` (I10).
            $table->string('default_locale', 2)->default('fr');

            $table->string('status', 20)->default('PENDING');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('approved_at')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index('status');
        });

        // La portée par agence du RBAC ne pouvait pas être contrainte plus tôt :
        // `role_user` est créée avant `agencies`.
        Schema::table('role_user', function (Blueprint $table) {
            $table->foreign('agency_id')->references('id')->on('agencies')->cascadeOnDelete();
        });

        Schema::create('agency_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->string('type', 50);
            $table->string('file_path');
            $table->string('status', 20)->default('PENDING');
            $table->date('expires_at')->nullable();
            $table->timestampsTz();
        });

        /*
         * Contrat commercial de l'agence (B4 du brief).
         *
         * Défini par l'administration, consultable par l'agence, jamais
         * modifiable en libre-service — ce sont des termes négociés.
         *
         * Une seule ligne par agence : l'historique est porté par `audit_logs`,
         * et la justesse des calculs passés est assurée par le figement de ces
         * valeurs sur chaque réservation, pas par un versionnement ici.
         */
        Schema::create('agency_commercial_terms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->unique()->constrained()->cascadeOnDelete();

            $table->string('commission_type', 15)->default('PERCENTAGE');
            $table->bigInteger('commission_value')->default(0);

            // Jamais le passager : le prix affiché divergerait du prix guichet,
            // et un comparateur qui n'affiche pas le vrai prix perd son objet.
            $table->string('fee_bearer', 15)->default('PLATFORM');

            // Reverser **avant** le départ est exclu : c'est la seule
            // configuration qui crée une créance irrécupérable.
            $table->smallInteger('payout_delay_hours')->default(24);
            $table->string('payout_frequency', 15)->default('WEEKLY');
            $table->smallInteger('payout_day')->default(1);
            $table->bigInteger('payout_minimum_amount')->default(0);

            // Désactivée par défaut : taxer la vente guichet ferait cesser sa
            // saisie, et l'on perdrait l'intégrité de la disponibilité (I2).
            $table->boolean('counter_sale_commission_enabled')->default(false);
            $table->boolean('counter_sale_sms_enabled')->default(true);

            $table->smallInteger('cancellation_deadline_hours')->default(2);
            $table->string('cancellation_fee_type', 15)->default('PERCENTAGE');
            $table->bigInteger('cancellation_fee_value')->default(0);

            $table->smallInteger('hold_duration_minutes')->default(10);
            $table->smallInteger('online_sales_cutoff_minutes')->default(30);

            $table->timestampsTz();
        });

        /*
         * Coordonnées de reversement.
         *
         * Le changement de ces coordonnées est un vecteur de fraude classique —
         * compromission du compte agence, modification du numéro, attente du
         * jour de paie. Toute création ou modification passe donc par
         * l'administration, est journalisée et notifiée à l'agence (B4).
         */
        Schema::create('agency_payout_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20);
            $table->string('operator', 20)->nullable();
            $table->string('account_number', 50);
            $table->string('account_name', 150);
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();

            // Obligatoire avant tout décaissement : une erreur de saisie envoie
            // l'argent à un inconnu, sans recours.
            $table->timestampTz('verified_at')->nullable();

            $table->boolean('is_active')->default(false);
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::table('role_user', function (Blueprint $table) {
            $table->dropForeign(['agency_id']);
        });

        Schema::dropIfExists('agency_payout_accounts');
        Schema::dropIfExists('agency_commercial_terms');
        Schema::dropIfExists('agency_documents');
        Schema::dropIfExists('agencies');
    }
};
