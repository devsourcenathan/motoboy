<?php

declare(strict_types=1);

namespace App\Modules\Administration\Http\Controllers;

use App\Modules\Administration\Support\IdDocumentPolicy;
use Illuminate\Http\JsonResponse;

/**
 * Ce que le client doit savoir avant d'afficher un formulaire.
 *
 * **Public, et volontairement pauvre.** Les reglages de plateforme vivent
 * derriere `platform.configure` — un passager ne peut pas les lire, et ne le doit
 * pas. Mais il lui faut savoir **quelle piece d'identite on va lui demander**,
 * faute de quoi l'ecran de reservation devine, se trompe une fois sur deux, et le
 * serveur refuse une saisie que le client n'avait pas su reclamer.
 *
 * N'exposer ici que ce qui **change ce que l'utilisateur voit**. Un taux de
 * commission ne le concerne pas ; la forme d'une piece a fournir, si. Chaque
 * champ ajoute ici est une decision de produit rendue publique, pas une commodite.
 */
final class ClientConfigController
{
    public function __invoke(IdDocumentPolicy $idDocuments): JsonResponse
    {
        return response()->json([
            'id_document_mode' => $idDocuments->mode(),
            'id_document_required' => $idDocuments->isRequired(),
        ]);
    }
}
