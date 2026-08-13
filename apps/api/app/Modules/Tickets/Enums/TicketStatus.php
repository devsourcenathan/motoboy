<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Enums;

enum TicketStatus: string
{
    case Valid = 'VALID';
    case Used = 'USED';
    case Cancelled = 'CANCELLED';
}
