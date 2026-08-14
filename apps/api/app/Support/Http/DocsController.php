<?php

declare(strict_types=1);

namespace App\Support\Http;

use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Documentation interactive du contrat.
 *
 * **Le fichier servi est celui qui fait foi** — pas une copie, pas une
 * régénération depuis le code. C'est le même `docs/openapi.yaml` dont le client
 * TypeScript est généré, dont les énumérations PHP sont vérifiées, et dont un
 * test compare les chemins aux routes réellement servies. Une documentation
 * dérivée d'autre chose finirait par décrire un produit qui n'existe pas.
 *
 * Consultable sans authentification par défaut, comme la plupart des API
 * publiques : le contrat n'est pas un secret, et le cacher n'empêche personne de
 * découvrir les routes. `API_DOCS_ENABLED=false` la ferme si le besoin change.
 */
final class DocsController
{
    /** Interface Swagger, épinglée à une version précise. */
    private const SWAGGER_VERSION = '5.17.14';

    public function page(): Response
    {
        $this->guard();

        return response($this->html())->header('Content-Type', 'text/html; charset=UTF-8');
    }

    public function spec(): Response
    {
        $this->guard();

        $path = $this->specPath();

        if ($path === null) {
            throw new NotFoundHttpException('Contrat introuvable.');
        }

        return response((string) file_get_contents($path))
            ->header('Content-Type', 'application/yaml; charset=UTF-8');
    }

    private function guard(): void
    {
        if (!config('api.docs_enabled', true)) {
            throw new NotFoundHttpException('Documentation désactivée.');
        }
    }

    /**
     * Deux emplacements, dans l'ordre.
     *
     * Dans l'image, le contrat est copié sous `storage/app` à la construction ;
     * en développement, il vit à sa place, dans `docs/`. Chercher les deux évite
     * d'en garder un exemplaire sous `apps/api` uniquement pour que les chemins
     * concordent.
     */
    private function specPath(): ?string
    {
        $candidates = [
            // Dans l'image, hors de `public/` pour que nginx ne le serve pas
            // avant Laravel — et donc avant l'interrupteur.
            storage_path('app/openapi.yaml'),
            // En développement, à sa place.
            base_path('../../docs/openapi.yaml'),
        ];

        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    private function html(): string
    {
        $version = self::SWAGGER_VERSION;

        return <<<HTML
        <!doctype html>
        <html lang="fr">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>MOTOBOY — contrat d'API</title>
            <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@{$version}/swagger-ui.css">
            <style>
                body { margin: 0; background: #fafafa; }
                .topbar { display: none; }
            </style>
        </head>
        <body>
            <div id="swagger"></div>
            <script src="https://unpkg.com/swagger-ui-dist@{$version}/swagger-ui-bundle.js"></script>
            <script>
                window.ui = SwaggerUIBundle({
                    url: '/openapi.yaml',
                    dom_id: '#swagger',
                    deepLinking: true,
                    // Les opérations sont regroupées par espace — passager,
                    // agence, administration — ce qui est la seule lecture utile
                    // sur un contrat de cette taille.
                    tagsSorter: 'alpha',
                    docExpansion: 'none',
                    persistAuthorization: true,
                });
            </script>
        </body>
        </html>
        HTML;
    }
}
