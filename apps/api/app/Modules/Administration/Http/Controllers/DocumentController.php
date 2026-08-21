<?php

declare(strict_types=1);

namespace App\Modules\Administration\Http\Controllers;

use App\Modules\Administration\Contracts\FileStorage;
use App\Modules\Agencies\Models\AgencyDocument;
use App\Modules\Rides\Models\DriverDocument;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Ouvrir une pièce déposée.
 *
 * **Rien ne permettait de le faire.** Une agence déposait son registre de
 * commerce, un chauffeur son permis, et aucun endpoint ne les rendait : ni à
 * l'administration qui doit statuer, ni à celui qui les avait envoyées.
 * `temporaryUrl` était implémenté et appelé de nulle part. La file de
 * modération listait les **types** de pièces reçues — « ce qui manque, d'un
 * coup d'œil » —, ce qui suffit à voir un dossier complet et jamais à
 * l'instruire. On approuvait donc sans lire.
 *
 * L'accès tient à la signature du lien, vérifiée par le middleware `signed`, et
 * non à une session : un document s'ouvre dans un onglet, qui ne porte pas le
 * jeton gardé en mémoire par le client.
 *
 * Le fichier est **diffusé** par l'API plutôt que servi par une URL de seau : le
 * seau n'est jamais exposé, et la consultation fonctionne à l'identique sur le
 * disque local, qui ne sait pas signer. Une fonctionnalité qui n'existe qu'en
 * production n'est jamais éprouvée avant d'y arriver.
 */
final class DocumentController
{
    public function __invoke(string $kind, int $document, FileStorage $storage): StreamedResponse
    {
        $record = match ($kind) {
            'agency' => AgencyDocument::query()->find($document),
            'driver' => DriverDocument::query()->find($document),
            default => null,
        };

        if ($record === null) {
            throw ApiException::of(ErrorCode::NotFound, 'Document introuvable.');
        }

        $path = (string) $record->file_path;

        /*
         * Le nom proposé porte le type et l'identifiant, jamais le nom d'origine
         * : il n'est pas conservé, et le chemin est un UUID choisi précisément
         * pour qu'aucune chaîne d'utilisateur n'entre dans un nom de fichier.
         */
        $type = $record->type;
        $extension = pathinfo($path, PATHINFO_EXTENSION);
        $name = $kind.'-'.$document.'-'.strtolower(is_string($type) ? $type : $type->value);

        return $storage->respond($path, $extension === '' ? $name : $name.'.'.$extension);
    }
}
