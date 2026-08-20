<?php

declare(strict_types=1);

namespace App\Modules\Administration\Http\Controllers;

use App\Modules\Administration\Support\IdDocumentPolicy;
use App\Modules\Places\Models\Country;
use Illuminate\Http\JsonResponse;

final class ClientConfigController
{
    public function __invoke(IdDocumentPolicy $idDocuments): JsonResponse
    {
        return response()->json([
            'id_document_mode' => $idDocuments->mode(),
            'id_document_required' => $idDocuments->isRequired(),

            /*
             * **Les pays desservis, parce qu'aucun formulaire ne peut s'afficher
             * sans eux.**
             *
             * Une agence qui reclame une ville absente doit dire de quel pays elle
             * releve, et rien n'exposait cette liste au client. Le contourner en
             * ecrivant `1` en dur fonctionnerait aujourd'hui — un seul pays est
             * seme — puis rattacherait silencieusement des demandes au mauvais
             * pays des le second.
             *
             * Trois champs et pas un de plus : cet endpoint est public et
             * volontairement pauvre. Le fuseau, la devise et l'indicatif
             * telephonique ne changent rien a ce qui s'affiche ici.
             *
             * Les pays inactifs sont ecartes : proposer un pays ou l'on ne vend pas
             * ferait deposer une demande que personne n'accepterait.
             */
            'countries' => Country::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get()
                ->map(fn (Country $country): array => [
                    'id' => $country->id,
                    'code' => $country->code,
                    'name' => $country->name,
                ])
                ->all(),
        ]);
    }
}
