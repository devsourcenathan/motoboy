<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();

            // Le téléphone est l'identifiant réel : il est vérifié par OTP (§8)
            // et sert de clé de rattachement d'un propriétaire à ses véhicules
            // (I3). L'email reste facultatif.
            $table->string('phone', 20)->unique();
            $table->string('email')->nullable()->unique();

            // Nullable : un passager peut n'utiliser que l'OTP. Les comptes
            // agence et administration, eux, ont un mot de passe.
            $table->string('password')->nullable();

            $table->string('first_name', 100);
            $table->string('last_name', 100);

            // Détermine la langue des SMS et notifications (I10).
            $table->string('locale', 2)->default('fr');

            $table->timestampTz('phone_verified_at')->nullable();
            $table->timestampTz('email_verified_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampTz('last_login_at')->nullable();

            $table->rememberToken();
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestampTz('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
