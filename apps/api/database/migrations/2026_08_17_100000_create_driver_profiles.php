<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Le dossier d'un chauffeur indépendant (E2).
 *
 * **Distinct de `drivers`, volontairement.** Cette table-là décrit un salarié
 * créé par un gestionnaire d'agence, et porte un `agency_id` obligatoire. Les
 * fusionner imposerait un `agency_id` nullable et un « de quel genre est ce
 * chauffeur ? » dans chaque requête d'agence — la première qui l'oublie fait
 * apparaître un indépendant dans le planning d'une agence.
 *
 * Le chauffeur n'est pas une identité de plus : c'est un `User` ordinaire,
 * connecté par OTP, portant le rôle `DRIVER`. Ce dossier lui ajoute ce qu'il
 * faut pour rouler.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_profiles', function (Blueprint $table) {
            $table->id();

            // Un dossier par personne. Deux dossiers, ce serait deux
            // validations possibles pour un même permis.
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();

            $table->string('status', 16)->default('PENDING');

            $table->string('license_number', 64);
            $table->date('license_expires_at');

            /*
             * Le véhicule vit ici, pas dans `vehicles` : celui-là appartient à
             * une agence, se voit affecter des départs et porte un plan de
             * sièges. Un indépendant en a un, le sien, et il n'entre dans aucun
             * planning.
             */
            $table->string('vehicle_plate', 32);
            $table->string('vehicle_type', 16);
            $table->string('vehicle_model', 120)->nullable();
            $table->unsignedSmallInteger('vehicle_seats');

            /*
             * Là où il travaille. Sans coordonnées nulle part (E3), la
             * proximité ne se calcule pas : c'est cette ville qui décidera
             * quelles demandes il voit.
             */
            $table->foreignId('city_id')->constrained();

            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();

            $table->timestamps();

            // La file de modération se lit par statut, du plus ancien au plus
            // récent.
            $table->index(['status', 'created_at']);
        });

        /*
         * Un refus sans motif est inexploitable : le chauffeur ne saurait pas
         * quoi corriger, et le support non plus. La base l'exige plutôt que la
         * seule validation de formulaire, parce que le refus peut aussi venir
         * d'une commande ou d'une reprise de données.
         */
        DB::statement(<<<'SQL'
            alter table driver_profiles add constraint driver_profiles_rejection_has_reason check (
                status <> 'REJECTED' or rejection_reason is not null
            )
        SQL);

        Schema::create('driver_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_profile_id')->constrained()->cascadeOnDelete();

            $table->string('type', 24);
            $table->string('file_path', 512);
            $table->date('expires_at')->nullable();

            $table->timestamps();

            // Une pièce par type : déposer une nouvelle carte grise remplace
            // l'ancienne, elle ne s'empile pas à côté.
            $table->unique(['driver_profile_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_documents');
        Schema::dropIfExists('driver_profiles');
    }
};
