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
        Schema::create('trips', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 20)->unique();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('route_id')->constrained()->restrictOnDelete();

            // Null si le départ a été créé à la main plutôt que généré.
            $table->foreignId('schedule_id')->nullable()->constrained()->nullOnDelete();

            // Dénormalisées depuis la route. La recherche est la requête
            // centrale du produit et filtre sur le couple de villes : la
            // jointure serait payée à chaque appel.
            $table->foreignId('origin_city_id')->constrained('cities')->restrictOnDelete();
            $table->foreignId('destination_city_id')->constrained('cities')->restrictOnDelete();

            $table->foreignId('origin_station_id')->constrained('stations')->restrictOnDelete();
            $table->foreignId('destination_station_id')->constrained('stations')->restrictOnDelete();

            $table->timestampTz('departure_at');
            $table->timestampTz('arrival_estimate_at')->nullable();

            // Sans cette borne, une réservation resterait possible quelques
            // secondes avant le départ — le passager ne peut matériellement pas
            // s'y présenter, et la liste d'embarquement est déjà établie (B2).
            $table->timestampTz('online_sales_close_at');

            $table->foreignId('vehicle_id')->constrained()->restrictOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained()->nullOnDelete();

            $table->bigInteger('price');
            $table->char('currency', 3)->default('XAF');

            $table->string('seating_mode', 15);
            $table->smallInteger('capacity');

            // Compteur utilisé en mode CAPACITY uniquement.
            $table->smallInteger('seats_taken')->default(0);

            $table->string('status', 20)->default('SCHEDULED');
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('cancelled_at')->nullable();
            $table->string('cancellation_reason', 30)->nullable();

            // Figé au moment de l'annulation : les réservations passent ensuite
            // en CANCELLED_BY_AGENCY et l'information serait perdue. Le taux
            // d'annulation d'une agence ne compte que les départs portant des
            // réservations confirmées — supprimer un départ généré non assuré
            // relève de la gestion de planning, pas de l'incident (I1).
            $table->boolean('had_confirmed_bookings_at_cancellation')->default(false);

            $table->timestampsTz();

            // Empêche la génération de produire deux fois le même départ.
            $table->unique(['schedule_id', 'departure_at']);

            // Index de recherche — la requête centrale du produit.
            $table->index(['origin_city_id', 'destination_city_id', 'departure_at', 'status']);
            $table->index(['agency_id', 'departure_at']);
            $table->index(['status', 'departure_at']);
        });

        // Garde-fou : si la logique métier se trompe, la base refuse l'écriture
        // au lieu de laisser survendre un départ en mode CAPACITY.
        DB::statement(<<<'SQL'
            alter table trips
                add constraint trips_seats_taken_within_capacity
                check (seats_taken >= 0 and seats_taken <= capacity)
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('trips');
    }
};
