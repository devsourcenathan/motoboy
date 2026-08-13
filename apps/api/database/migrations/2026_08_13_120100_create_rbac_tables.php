<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * RBAC (§9 du brief). Les permissions sont **indépendantes des rôles**, ce qui
 * permet de faire évoluer un rôle sans toucher au code.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 30)->unique();
            $table->string('label', 100);
            $table->boolean('is_system')->default(true);
            $table->timestampsTz();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60)->unique();
            $table->string('label', 150);
            $table->string('group', 40)->index();
            $table->timestampsTz();
        });

        Schema::create('permission_role', function (Blueprint $table) {
            $table->foreignId('permission_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();

            $table->primary(['permission_id', 'role_id']);
        });

        Schema::create('role_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();

            // La portée par agence est indispensable : un utilisateur porte le
            // rôle AGENT **pour une agence donnée**. Sans elle, un agent
            // d'embarquement validerait les billets de toutes les agences de la
            // plateforme.
            //
            // La contrainte de clé étrangère est posée dans la migration des
            // agences, qui n'existent pas encore à ce stade.
            $table->unsignedBigInteger('agency_id')->nullable();

            $table->timestampsTz();
            $table->index('agency_id');
        });

        // Deux index uniques partiels plutôt qu'une clé primaire composite :
        // `agency_id` est nullable pour les rôles globaux — PASSENGER, ADMIN —
        // et PostgreSQL rendrait silencieusement la colonne NOT NULL si elle
        // entrait dans une clé primaire.
        //
        // Un index unique ordinaire ne suffirait pas non plus : PostgreSQL
        // considère deux NULL comme distincts, donc (user, role, NULL) pourrait
        // être inséré deux fois.
        DB::statement(<<<'SQL'
            create unique index role_user_scoped_unique
                on role_user (user_id, role_id, agency_id)
                where agency_id is not null
        SQL);

        DB::statement(<<<'SQL'
            create unique index role_user_global_unique
                on role_user (user_id, role_id)
                where agency_id is null
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('permission_role');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
    }
};
