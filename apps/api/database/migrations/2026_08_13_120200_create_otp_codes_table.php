<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** OTP SMS (§8 du brief) : validité 10 minutes, 4 tentatives au maximum. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('otp_codes', function (Blueprint $table) {
            $table->id();
            $table->string('phone', 20);

            // Le code n'est jamais stocké en clair.
            $table->string('code_hash');

            $table->string('purpose', 30);
            $table->timestampTz('expires_at');
            $table->smallInteger('attempts')->default(0);
            $table->timestampTz('consumed_at')->nullable();
            $table->timestampTz('created_at')->nullable();

            $table->index(['phone', 'purpose', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('otp_codes');
    }
};
