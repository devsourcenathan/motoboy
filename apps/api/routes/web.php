<?php

declare(strict_types=1);

use App\Support\Http\DocsController;
use Illuminate\Support\Facades\Route;

/*
 * Cette application est une API REST (§5 du brief). Elle ne sert aucune vue —
 * à l'exception de la documentation du contrat : l'échafaudage front de
 * Laravel — package.json, vite.config.js, resources/js — a été retiré, car un
 * package.json ici serait happé par le workspace pnpm et casserait la frontière
 * posée en §6 (« Laravel dans le dépôt, hors du workspace JS »).
 *
 * Les routes de l'API vivent dans routes/api.php, sous le préfixe /api/v1.
 */

Route::get('/', fn () => response()->json([
    'name' => 'MOTOBOY API',
    'docs' => '/docs',
    'spec' => '/openapi.yaml',
]));

/*
 * Le contrat, et sa lecture interactive.
 *
 * Le fichier servi est **celui qui fait foi** : le même dont le client
 * TypeScript est généré, dont les énumérations PHP sont vérifiées, et dont un
 * test compare les chemins aux routes réellement servies.
 */
Route::get('docs', [DocsController::class, 'page']);
Route::get('openapi.yaml', [DocsController::class, 'spec']);
