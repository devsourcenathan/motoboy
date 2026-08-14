<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('agency_id')->constrained()->restrictOnDelete();
            $table->bigInteger('base_amount');

            // Recopiés depuis la réservation, elle-même figée à sa création.
            $table->string('type', 15);
            $table->bigInteger('value');

            $table->bigInteger('amount');
            $table->bigInteger('aggregator_fee_amount')->default(0);

            // La commission n'est pas prélevée sur une réservation annulée : MOTOBOY
            // récupère uniquement ses frais réels sur les frais d'annulation retenus,
            // le solde revenant à l'agence, qui subit la perte réelle du siège (B5).
            $table->string('status', 20)->default('ACCRUED');
            $table->timestampTz('reversed_at')->nullable();

            $table->timestampsTz();

            $table->index(['agency_id', 'status']);
        });

        /*
         * Compte courant par agence (B4).
         *
         * Ce choix plutôt qu'un calcul par période absorbe naturellement les
         * soldes négatifs, les régularisations tardives et les corrections
         * manuelles.
         *
         * **Aucun solde stocké** : il se calcule par somme. Un solde
         * dénormalisé finit toujours par diverger de ses écritures, et sur un
         * compte qui détermine combien l'on verse à une agence, la divergence
         * se découvre lors d'une réclamation.
         *
         * Les écritures sont **immuables** : une erreur se corrige par une
         * écriture inverse, jamais par une modification.
         */
        Schema::create('agency_ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->restrictOnDelete();
            $table->string('type', 30);

            // Signé : positif au crédit, négatif au débit.
            $table->bigInteger('amount');

            $table->char('currency', 3)->default('XAF');
            $table->string('reference_type', 50)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();

            // Obligatoire sur un ajustement manuel.
            $table->string('description', 255)->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            // Date d'effet, distincte de la date d'écriture.
            $table->timestampTz('occurred_at');

            $table->timestampTz('created_at')->nullable();

            $table->index(['agency_id', 'occurred_at']);
            $table->index(['reference_type', 'reference_id']);
        });

        Schema::create('payouts', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 20)->unique();
            $table->foreignId('agency_id')->constrained()->restrictOnDelete();
            $table->date('period_start');
            $table->date('period_end');

            $table->bigInteger('gross_amount');
            $table->bigInteger('commission_amount');
            $table->bigInteger('refund_amount');
            $table->bigInteger('adjustment_amount')->default(0);
            $table->bigInteger('net_amount');
            $table->char('currency', 3)->default('XAF');

            $table->foreignId('payout_account_id')->constrained('agency_payout_accounts')->restrictOnDelete();

            // Le calcul est automatique, le déclenchement est manuel : un
            // décaissement Mobile Money du mauvais montant est quasi
            // irréversible, et les premiers mois produiront des cas non
            // anticipés (B4).
            $table->string('status', 25)->default('DRAFT');

            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('approved_at')->nullable();
            $table->string('provider_reference', 100)->nullable();
            $table->timestampTz('paid_at')->nullable();
            $table->string('failure_reason', 255)->nullable();
            $table->timestampsTz();

            $table->index(['agency_id', 'status']);
        });

        // Détail du relevé téléchargeable par l'agence — le document qui évite
        // les litiges répétés sur les montants.
        Schema::create('payout_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payout_id')->constrained()->cascadeOnDelete();
            $table->foreignId('booking_id')->constrained()->restrictOnDelete();
            $table->bigInteger('gross_amount');
            $table->bigInteger('commission_amount');
            $table->bigInteger('refund_amount')->default(0);
            $table->bigInteger('net_amount');

            $table->unique(['payout_id', 'booking_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payout_lines');
        Schema::dropIfExists('payouts');
        Schema::dropIfExists('agency_ledger_entries');
        Schema::dropIfExists('commissions');
    }
};
