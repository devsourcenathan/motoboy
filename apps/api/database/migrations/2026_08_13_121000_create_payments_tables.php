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
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 20)->unique();

            // Une réservation porte **plusieurs tentatives**, dont une seule
            // aboutie : avec Mobile Money l'échec est banal, et réessayer est le
            // cas nominal (B2).
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();

            $table->bigInteger('amount');
            $table->char('currency', 3)->default('XAF');
            $table->string('method', 20);
            $table->string('operator', 20)->nullable();

            // Null pour la méthode CASH : la vente au guichet ne transite jamais
            // par l'agrégateur (I2).
            $table->string('provider', 50)->nullable();

            $table->string('provider_reference', 100)->nullable();
            $table->string('idempotency_key', 100)->unique();
            $table->string('status', 20)->default('PENDING');
            $table->string('failure_reason', 100)->nullable();

            // Frais réels de collecte, nécessaires au calcul de répartition des
            // frais d'annulation (B5).
            $table->bigInteger('aggregator_fee_amount')->default(0);

            $table->timestampTz('paid_at')->nullable();
            $table->timestampsTz();

            $table->index(['booking_id', 'status']);
        });

        // Un seul paiement abouti par réservation. Garde-fou contre le double
        // paiement (§17) : si la logique applicative se trompe, la base refuse.
        DB::statement(<<<'SQL'
            create unique index payments_one_success_per_booking
                on payments (booking_id)
                where status = 'SUCCEEDED'
        SQL);

        /*
         * Journal traçable des webhooks (I7).
         *
         * Sans lui, un paiement perdu est indébogable. Il complète la
         * réconciliation quotidienne de B4 : la réconciliation détecte l'écart,
         * le journal explique son origine.
         */
        Schema::create('payment_webhooks', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 50);

            // Idempotence du rejeu : les prestataires réémettent.
            $table->string('event_id', 150);

            $table->jsonb('payload');
            $table->boolean('signature_valid')->default(false);
            $table->timestampTz('received_at');
            $table->timestampTz('processed_at')->nullable();
            $table->string('status', 20)->default('RECEIVED');
            $table->text('error')->nullable();
            $table->timestampsTz();

            $table->unique(['provider', 'event_id']);
            $table->index('status');
        });

        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 20)->unique();
            $table->foreignId('booking_id')->constrained()->restrictOnDelete();

            // Le remboursement part **toujours vers le compte source**, jamais
            // vers un numéro déclaré après coup : sinon le circuit « je réserve,
            // j'annule, je me fais rembourser ailleurs » devient un vecteur de
            // fraude immédiat (B5).
            $table->foreignId('payment_id')->constrained()->restrictOnDelete();

            // Renseigné si remboursement partiel.
            $table->foreignId('booking_passenger_id')->nullable()->constrained()->nullOnDelete();

            $table->bigInteger('amount');
            $table->char('currency', 3)->default('XAF');
            $table->string('reason', 30);

            // Null si déclenché automatiquement.
            $table->foreignId('initiated_by')->nullable()->constrained('users')->nullOnDelete();

            $table->string('provider_reference', 100)->nullable();
            $table->string('idempotency_key', 100)->unique();
            $table->string('status', 20)->default('PENDING');
            $table->smallInteger('retry_count')->default(0);
            $table->timestampTz('completed_at')->nullable();
            $table->timestampsTz();

            // Job de rejeu : un remboursement en échec place le passager dans le
            // pire état possible — sans argent et sans billet.
            $table->index(['status', 'retry_count']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('payment_webhooks');
        Schema::dropIfExists('payments');
    }
};
