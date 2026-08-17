<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * L'appel de service : demande, offres, course (E1).
 *
 * Trois tables parce qu'il y a trois objets de durées de vie différentes. Une
 * demande vit quelques dizaines de minutes puis expire. Une offre vit moins
 * longtemps encore. Une course survit à tout, parce qu'elle porte de l'argent et
 * doit rester consultable des mois plus tard.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_requests', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 24)->unique();

            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            /*
             * Ville du référentiel **plus** un point de repère en texte libre
             * (E3). « Bafang » situe, « carrefour Total » permet de se trouver.
             * Aucune coordonnée : la position est déclarée, jamais captée.
             */
            $table->foreignId('origin_city_id')->constrained('cities');
            $table->string('origin_landmark', 160);
            $table->foreignId('destination_city_id')->constrained('cities');
            $table->string('destination_landmark', 160)->nullable();

            $table->unsignedSmallInteger('passengers')->default(1);
            $table->text('note')->nullable();

            $table->string('status', 24)->default('OPEN');

            /*
             * Une demande sans réponse ne reste pas ouverte indéfiniment : un
             * chauffeur qui répond deux heures après ne rend service à personne,
             * et le passager doit savoir qu'il n'aura rien plutôt que d'attendre.
             */
            $table->timestamp('expires_at');

            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('cancellation_reason')->nullable();

            $table->timestamps();

            // La liste qu'un chauffeur consulte : les demandes ouvertes de sa
            // ville, les plus anciennes d'abord.
            $table->index(['status', 'origin_city_id', 'created_at']);
        });

        Schema::create('ride_offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_profile_id')->constrained()->cascadeOnDelete();

            /*
             * Un prix ferme, pas une fourchette (E1). C'est le chauffeur qui le
             * fixe : il n'existe aucune table de distances dont dériver un
             * barème, et le marché tarife déjà ces trajets en gare.
             */
            $table->unsignedBigInteger('price_amount');
            $table->string('currency', 3)->default('XAF');

            /** Délai annoncé avant d'être sur place, en minutes. */
            $table->unsignedSmallInteger('eta_minutes');

            $table->string('status', 16)->default('PENDING');
            $table->timestamp('expires_at');

            $table->timestamps();

            // Une offre par chauffeur et par demande : surenchérir sur soi-même
            // n'a pas de sens, et deux offres du même chauffeur rendraient la
            // comparaison illisible.
            $table->unique(['service_request_id', 'driver_profile_id']);
        });

        /*
         * **Une seule offre acceptée par demande.** Deux passagers ne peuvent
         * pas accepter en même temps, et deux appels concurrents du même
         * passager non plus : c'est la base qui refuse le second, comme pour la
         * double-vente de sièges (B2). Le vérifier en PHP laisserait passer les
         * deux requêtes arrivées à la même milliseconde.
         */
        DB::statement(<<<'SQL'
            create unique index ride_offers_one_accepted_per_request
                on ride_offers (service_request_id)
                where status = 'ACCEPTED'
        SQL);

        Schema::create('rides', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 24)->unique();

            $table->foreignId('service_request_id')->unique()->constrained();
            $table->foreignId('ride_offer_id')->unique()->constrained();
            $table->foreignId('driver_profile_id')->constrained();

            // Le prix convenu est recopié : l'offre peut expirer ou être
            // nettoyée, la course doit rester lisible telle qu'elle a été
            // conclue.
            $table->unsignedBigInteger('price_amount');
            $table->string('currency', 3)->default('XAF');

            $table->string('status', 16)->default('MATCHED');

            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('cancellation_reason')->nullable();

            $table->timestamps();
        });

        /*
         * **Une seule course active par chauffeur.** Un chauffeur ne peut pas
         * être à deux endroits : accepter une seconde course pendant la première
         * promettrait un véhicule qui n'arrivera pas. Index partiel, pour que les
         * courses terminées ne bloquent rien.
         */
        DB::statement(<<<'SQL'
            create unique index rides_one_active_per_driver
                on rides (driver_profile_id)
                where status in ('MATCHED', 'IN_PROGRESS')
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('rides');
        Schema::dropIfExists('ride_offers');
        Schema::dropIfExists('service_requests');
    }
};
