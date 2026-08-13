<?php

declare(strict_types=1);

namespace App\Modules\Payments\Enums;

enum PaymentStatus: string
{
    case Pending = 'PENDING';
    case Processing = 'PROCESSING';
    case Succeeded = 'SUCCEEDED';
    case Failed = 'FAILED';
}
