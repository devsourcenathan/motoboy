<?php

declare(strict_types=1);

namespace App\Modules\Administration\Storage;

use App\Modules\Administration\Contracts\FileStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Pilote adossé à un disque Laravel.
 *
 * Il sert le disque local en développement **et** Cloudflare R2 en production :
 * R2 étant compatible S3, un seul adaptateur couvre les deux, et le changement
 * se fait par la configuration du disque.
 */
final class DiskFileStorage implements FileStorage
{
    public function __construct(private readonly string $disk) {}

    public function put(UploadedFile $file, string $directory): string
    {
        // Nom généré, extension déduite du contenu réel : reprendre le nom
        // fourni laisserait deux agences déposant « licence.pdf » s'écraser, et
        // ferait entrer une chaîne d'utilisateur dans un chemin de fichier.
        $name = Str::uuid()->toString().'.'.($file->guessExtension() ?? 'bin');

        $path = $file->storeAs($directory, $name, ['disk' => $this->disk]);

        if (!is_string($path)) {
            throw new RuntimeException("Échec du dépôt du fichier dans « {$directory} ».");
        }

        return $path;
    }

    public function temporaryUrl(string $path, int $minutes = 10): string
    {
        try {
            return Storage::disk($this->disk)->temporaryUrl($path, now()->addMinutes($minutes));
        } catch (RuntimeException) {
            // Le disque local ne sait pas signer d'URL et lève. Plutôt que de
            // renvoyer un lien permanent — qui contredirait la raison d'être de
            // cette méthode —, on renvoie le chemin : en développement, la
            // consultation passe par l'endpoint authentifié, pas par le disque.
            return $path;
        }
    }

    public function respond(string $path, string $filename): StreamedResponse
    {
        // `inline` et non `attachment` : une pièce se regarde pour décider, et
        // forcer un téléchargement obligerait à ouvrir chaque fichier depuis le
        // dossier des téléchargements pour instruire un seul dossier.
        return Storage::disk($this->disk)->response($path, $filename, [
            'Content-Disposition' => 'inline; filename="'.addslashes($filename).'"',
        ]);
    }

    public function delete(string $path): void
    {
        Storage::disk($this->disk)->delete($path);
    }
}
