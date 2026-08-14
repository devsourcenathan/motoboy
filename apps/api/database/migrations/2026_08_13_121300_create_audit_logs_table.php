<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Journalisation des opérations sensibles (§28 du brief).
 *
 * À journaliser impérativement : création et modification d'un trajet,
 * modification d'un prix, annulation d'une réservation, validation d'un billet,
 * remboursement, approbation d'un reversement, **modification des coordonnées
 * de reversement**, modification des conditions commerciales, validation d'une
 * agence.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();

            // Null pour une action système — job de libération, génération de
            // départs, remboursement automatique.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->string('action', 50);
            $table->string('auditable_type', 100);
            $table->unsignedBigInteger('auditable_id');
            $table->jsonb('old_values')->nullable();
            $table->jsonb('new_values')->nullable();
            $table->ipAddress('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->timestampTz('created_at')->nullable();

            $table->index(['auditable_type', 'auditable_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
