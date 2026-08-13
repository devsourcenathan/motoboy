<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

/**
 * Langues servies dès le lancement (I10 du brief).
 *
 * Le Cameroun a deux langues officielles, et les régions du Nord-Ouest et du
 * Sud-Ouest sont anglophones — Bamenda, Buea et Limbe sont des destinations
 * interurbaines réelles. L'anglais n'est pas un sujet d'expansion : c'est une
 * partie du marché de lancement.
 */
enum Locale: string
{
    case French = 'fr';
    case English = 'en';
}
