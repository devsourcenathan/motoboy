<?php

declare(strict_types=1);

namespace App\Modules\Administration\Support;

use Illuminate\Support\Facades\URL;

/**
 * Le lien de consultation d'une pièce.
 *
 * **Signé plutôt qu'authentifié**, et ce n'est pas une commodité : un document
 * s'ouvre dans un onglet, par un simple lien, et un onglet ne porte pas le jeton
 * de session que le client garde en mémoire. Sans signature, il faudrait
 * télécharger le fichier en arrière-plan pour le ré-exposer — ce qui recrée une
 * URL locale non révocable et fait passer chaque pièce par la mémoire du
 * navigateur.
 *
 * Dix minutes : le temps d'instruire un dossier, pas celui d'oublier un lien
 * dans une conversation. Passé ce délai la signature ne vaut plus rien, alors
 * qu'une URL de seau resterait valable aussi longtemps que l'objet.
 *
 * La signature dérive d'`APP_KEY` — la même clé que les billets. C'est une
 * raison de plus de ne jamais la faire tourner après la première mise en
 * service.
 */
final class DocumentLink
{
    public const MINUTES = 10;

    public static function for(string $kind, int $id): string
    {
        return URL::temporarySignedRoute('documents.show', now()->addMinutes(self::MINUTES), [
            'kind' => $kind,
            'document' => $id,
        ]);
    }
}
