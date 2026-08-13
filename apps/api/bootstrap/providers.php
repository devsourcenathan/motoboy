<?php

declare(strict_types=1);

use App\Providers\AppServiceProvider;
use App\Providers\PaymentServiceProvider;
use App\Providers\SmsServiceProvider;

return [
    AppServiceProvider::class,
    SmsServiceProvider::class,
    PaymentServiceProvider::class,
];
