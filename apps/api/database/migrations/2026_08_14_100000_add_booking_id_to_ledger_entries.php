<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agency_ledger_entries', function (Blueprint $table) {
            /*
             * À quelle réservation l'écriture se rapporte.
             *
             * `reference_type` / `reference_id` désignent l'objet **écrit** —
             * une commission, un remboursement — et non la réservation. Sans
             * cette colonne, déterminer ce qui est reversable obligerait à
             * remonter chaque type d'objet par une jointure différente, et
             * comparer des identifiants entre familles ferait correspondre une
             * commission à une réservation portant le même numéro.
             *
             * Null pour ce qui ne concerne aucune réservation : ajustement
             * manuel, reversement, contre-passation de reversement. C'est
             * précisément ce qui est reversable immédiatement (B4).
             */
            $table->foreignId('booking_id')->nullable()->after('agency_id')
                ->constrained()->nullOnDelete();

            // La construction d'un reversement lit ces deux colonnes ensemble.
            $table->index(['agency_id', 'booking_id']);
        });
    }

    public function down(): void
    {
        Schema::table('agency_ledger_entries', function (Blueprint $table) {
            $table->dropIndex(['agency_id', 'booking_id']);
            $table->dropConstrainedForeignId('booking_id');
        });
    }
};
