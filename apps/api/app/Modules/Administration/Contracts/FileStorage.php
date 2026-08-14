<?php

declare(strict_types=1);

namespace App\Modules\Administration\Contracts;

use Illuminate\Http\UploadedFile;

/**
 * Port de stockage de fichiers.
 *
 * Exprimé en vocabulaire métier, comme les autres ports (§7 du brief) : aucun
 * appelant ne sait si le fichier finit sur un disque local ou chez un
 * fournisseur objet.
 *
 * Le fournisseur retenu est **Cloudflare R2**, compatible S3 — le passage se
 * fera donc en configuration. Le pilote local permet de construire le dépôt de
 * documents sans compte ni réseau, exactement comme le pilote de journalisation
 * a permis de construire l'OTP sans prestataire SMS.
 */
interface FileStorage
{
    /**
     * Range un fichier et renvoie son chemin.
     *
     * Le nom d'origine n'est **jamais** repris tel quel : il est fourni par
     * l'utilisateur, peut contenir n'importe quoi, et deux agences déposant
     * « licence.pdf » s'écraseraient l'une l'autre.
     */
    public function put(UploadedFile $file, string $directory): string;

    /**
     * URL de consultation, à durée limitée.
     *
     * Un document d'agence — registre de commerce, pièce d'identité d'un
     * dirigeant — ne doit pas être atteignable par une URL permanente qui
     * circulerait ensuite hors de tout contrôle.
     */
    public function temporaryUrl(string $path, int $minutes = 10): string;

    public function delete(string $path): void;
}
