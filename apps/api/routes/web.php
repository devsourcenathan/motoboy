<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;

/*
 * Cette application est une API REST (§5 du brief). Elle ne sert aucune vue :
 * l'échafaudage front de Laravel — package.json, vite.config.js, resources/js —
 * a été retiré, car un package.json ici serait happé par le workspace pnpm et
 * casserait la frontière posée en §6 (« Laravel dans le dépôt, hors du
 * workspace JS »).
 *
 * Les routes de l'API vivent dans routes/api.php, sous le préfixe /api/v1.
 */

Route::get('/', fn () => response()->json([
    'name' => 'MOTOBOY API',
    'docs' => '/docs/openapi.yaml',
]));
