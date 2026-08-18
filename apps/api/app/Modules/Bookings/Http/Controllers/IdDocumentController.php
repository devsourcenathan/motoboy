<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Controllers;

use App\Modules\Administration\Contracts\FileStorage;
use App\Modules\Identity\Models\User;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

/**
 * Depot de la piece d'identite du voyageur principal.
 *
 * **Separe de la reservation, et avant elle.** Une place se tient pendant
 * quelques minutes ; joindre l'image au meme appel ferait courir ce delai pendant
 * un televersement sur une 3G de gare, et un echec de reseau ferait perdre la
 * place. Le client depose d'abord, recoit un chemin, puis reserve avec ce chemin
 * — le meme decoupage que les pieces du chauffeur.
 *
 * **Le chemin n'est pas devinable** : il est tire au hasard par le stockage, et
 * le client ne peut donc pas en fabriquer un pour designer le fichier de
 * quelqu'un d'autre.
 */
final class IdDocumentController
{
    public function store(Request $request, FileStorage $storage): JsonResponse
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session absente.');
        }

        $request->validate([
            /*
             * Pas de PDF, contrairement au dossier du chauffeur : on demande la
             * photo d'une piece, prise avec le telephone. Accepter un document
             * inviterait a deposer autre chose qu'une identite.
             */
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png', 'max:8192'],
        ]);

        $file = $request->file('file');

        if (!$file instanceof UploadedFile) {
            throw ApiException::of(ErrorCode::ValidationFailed, 'Fichier absent.');
        }

        /*
         * Range sous l'identifiant de l'utilisateur : deux passagers ne se
         * marchent pas dessus, et une demande de suppression ulterieure sait ou
         * chercher.
         */
        return response()->json([
            'path' => $storage->put($file, "id-documents/{$user->id}"),
        ], 201);
    }
}
