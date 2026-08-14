<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            /*
             * Frais d'annulation retenus sur ce remboursement.
             *
             * Ils pourraient se déduire — part payée moins montant rendu — mais
             * cette soustraction cesserait d'être vraie au premier
             * remboursement qui n'est pas une annulation, et le coût réel du
             * remboursement n'arrive qu'après coup : c'est contre ce montant
             * qu'il est plafonné quand le prestataire l'annonce (B5).
             */
            $table->bigInteger('fee_amount')->default(0)->after('amount');

            // Places couvertes, pour le prorata des écritures au compte courant.
            $table->smallInteger('seats_count')->default(1)->after('fee_amount');
        });

        Schema::table('trips', function (Blueprint $table) {
            /*
             * Le motif est un code court, obligatoire, qui alimente le suivi du
             * taux d'annulation. La note est le texte libre de l'agent — « pont
             * coupé à Melong » — que le passager lit dans sa notification : sans
             * elle, il reçoit « panne » et rappelle l'agence.
             */
            $table->string('cancellation_note', 500)->nullable()->after('cancellation_reason');
        });
    }

    public function down(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            $table->dropColumn(['fee_amount', 'seats_count']);
        });

        Schema::table('trips', function (Blueprint $table) {
            $table->dropColumn('cancellation_note');
        });
    }
};
