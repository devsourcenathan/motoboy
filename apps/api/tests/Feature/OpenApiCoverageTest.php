<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Symfony\Component\Yaml\Yaml;
use Tests\TestCase;

/**
 * Rend vrai le mot « normative ».
 *
 * La spécification se déclare source de vérité du contrat. Sans vérification,
 * c'est une intention : rien n'empêche un endpoint d'être servi sans être
 * spécifié, et c'est exactement ce qui s'est produit — treize routes du
 * back-office agence ont vécu implémentées et absentes du contrat, pendant que
 * quatre chemins spécifiés n'existaient nulle part.
 *
 * Ce test compare les routes enregistrées aux chemins déclarés, **dans les deux
 * sens**. Il ne valide pas les schémas de corps de requête : c'est la couverture
 * qui dérive en premier, et la couverture qu'il faut donc tenir en premier.
 */
final class OpenApiCoverageTest extends TestCase
{
    /**
     * Chemins spécifiés dont l'implémentation est **délibérément** en attente.
     *
     * Cette liste est le prix de l'honnêteté : sans elle, on serait tenté de
     * retirer de la spécification ce qui n'est pas encore construit, et le
     * contrat cesserait de décrire le produit visé pour ne décrire que l'état
     * du code.
     *
     * @var list<string>
     */
    private const PENDING = [
        // Vide : tout ce que le contrat décrit existe. C'est l'état normal, pas
        // un état à préserver — la liste se remplira au prochain chantier
        // spécifié avant d'être construit.
    ];

    public function test_no_endpoint_is_served_without_being_specified(): void
    {
        $undocumented = array_diff($this->implemented(), $this->specified());

        $this->assertSame([], array_values($undocumented), sprintf(
            "Ces routes sont servies sans figurer dans docs/openapi.yaml :\n  %s\n".
            'La spécification est normative : la compléter, ne pas retirer la route.',
            implode("\n  ", $undocumented),
        ));
    }

    public function test_every_specified_path_is_implemented_or_declared_pending(): void
    {
        $missing = array_diff($this->specified(), $this->implemented(), self::PENDING);

        $this->assertSame([], array_values($missing), sprintf(
            "Ces chemins sont spécifiés mais introuvables :\n  %s\n".
            'Les implémenter, ou les déclarer dans PENDING avec leur raison.',
            implode("\n  ", $missing),
        ));
    }

    public function test_the_pending_list_does_not_outlive_its_purpose(): void
    {
        // Un chemin listé en attente puis implémenté doit sortir de la liste,
        // sinon elle finit par masquer une vraie régression.
        $stale = array_intersect(self::PENDING, $this->implemented());

        $this->assertSame([], array_values($stale), sprintf(
            "Ces chemins sont implémentés mais encore déclarés en attente :\n  %s",
            implode("\n  ", $stale),
        ));
    }

    /** @return list<string> */
    private function specified(): array
    {
        /** @var array{paths: array<string, array<string, mixed>>} $spec */
        $spec = Yaml::parseFile(base_path('../../docs/openapi.yaml'));

        $paths = [];

        foreach ($spec['paths'] as $path => $operations) {
            foreach (array_keys($operations) as $verb) {
                if (in_array($verb, ['get', 'post', 'put', 'patch', 'delete'], true)) {
                    $paths[] = strtoupper($verb).' '.$path;
                }
            }
        }

        sort($paths);

        return $paths;
    }

    /** @return list<string> */
    private function implemented(): array
    {
        $routes = [];

        foreach (Route::getRoutes()->getRoutes() as $route) {
            $uri = '/'.$route->uri();

            if (!str_starts_with($uri, '/api/v1')) {
                continue;
            }

            // Le préfixe `/api` vient du routage Laravel ; le contrat, lui,
            // déclare des chemins à partir de la version.
            $path = substr($uri, strlen('/api'));

            foreach ($route->methods() as $method) {
                if (in_array($method, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) {
                    $routes[] = $method.' '.$path;
                }
            }
        }

        $routes = array_values(array_unique($routes));
        sort($routes);

        return $routes;
    }
}
