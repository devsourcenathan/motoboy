<?php

declare(strict_types=1);

namespace App\Modules\Rides\Enums;

/**
 * Les pièces d'un dossier chauffeur.
 *
 * Les quatre sont exigées avant validation : sans agence pour répondre d'un
 * incident, ce dossier est tout ce dont dispose la plateforme.
 */
enum DriverDocumentType: string
{
    case License = 'LICENSE';
    case Registration = 'REGISTRATION';
    case Identity = 'IDENTITY';
    case Insurance = 'INSURANCE';
}
