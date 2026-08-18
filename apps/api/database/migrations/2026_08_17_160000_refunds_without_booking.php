<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Un remboursement peut ne porter sur aucune reservation.
 *
 * Il pointe deja le paiement, lequel porte son objet — reservation **ou** course
 * (E4 bis). Exiger en plus une reservation rendait impossible de rembourser une
 * course, alors que deux des quatre decisions d'argent en dependent : annulation
 * avant depart, et chauffeur absent.
 *
 * Exprime en Blueprint et non en SQL brut : l'analyse statique lit le schema dans
 * les migrations, et un `DB::statement` lui reste invisible — les controles de
 * nullite ecrits autour seraient alors declares morts a tort.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            $table->foreignId('booking_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            $table->foreignId('booking_id')->nullable(false)->change();
        });
    }
};
