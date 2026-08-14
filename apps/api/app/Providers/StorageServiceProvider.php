<?php

declare(strict_types=1);

namespace App\Providers;

use App\Modules\Administration\Contracts\FileStorage;
use App\Modules\Administration\Storage\DiskFileStorage;
use Illuminate\Support\ServiceProvider;

/**
 * Résout le stockage de fichiers depuis la configuration.
 *
 * Le disque `documents` pointe sur le disque local en développement et sur
 * Cloudflare R2 en production. Aucune Action ne connaît la différence (§7).
 */
final class StorageServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(
            FileStorage::class,
            fn (): FileStorage => new DiskFileStorage((string) config('filesystems.documents_disk', 'local')),
        );
    }
}
