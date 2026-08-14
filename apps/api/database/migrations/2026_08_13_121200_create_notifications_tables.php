<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();

            // Null pour un passager de vente au guichet, qui n'a pas de compte.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            // Destinataire sans compte.
            $table->string('phone', 20)->nullable();

            $table->string('channel', 10);

            // Langue effectivement utilisée — tracée, car la résolution dépend
            // du destinataire : `users.locale` pour un compte, langue par défaut
            // de l'agence sinon (I10).
            $table->string('locale', 2);

            $table->string('type', 50);
            $table->jsonb('payload');
            $table->string('status', 20)->default('QUEUED');
            $table->string('provider_reference', 100)->nullable();
            $table->timestampTz('sent_at')->nullable();
            $table->text('error')->nullable();
            $table->timestampsTz();

            $table->index(['status', 'channel']);
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('device_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token')->unique();
            $table->string('platform', 10);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_tokens');
        Schema::dropIfExists('notifications');
    }
};
