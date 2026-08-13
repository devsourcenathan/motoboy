<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Identity\Enums\Locale;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Enums\RefundReason;
use App\Modules\Payments\Enums\RefundStatus;
use App\Modules\Tickets\Enums\TicketStatus;
use App\Modules\Tickets\Enums\ValidationMethod;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Yaml\Yaml;
use Tests\TestCase;

/**
 * Parité entre les énumérations de la spécification OpenAPI et celles de PHP.
 *
 * La spécification est normative : côté TypeScript, les énumérations en sont
 * **générées** et ne peuvent pas diverger. Côté PHP, elles sont écrites à la
 * main — c'est donc le seul point du système où une énumération existe en deux
 * exemplaires, et le seul endroit où elle peut dériver.
 *
 * Ce test n'est pas une formalité : sans lui, ajouter un motif de remboursement
 * dans la spécification laisserait PHP l'ignorer silencieusement.
 */
final class EnumParityTest extends TestCase
{
    /** @return array<string, array{string, class-string}> */
    public static function enums(): array
    {
        return [
            'BookingStatus' => ['BookingStatus', BookingStatus::class],
            'PaymentStatus' => ['PaymentStatus', PaymentStatus::class],
            'PaymentMethod' => ['PaymentMethod', PaymentMethod::class],
            'RefundStatus' => ['RefundStatus', RefundStatus::class],
            'RefundReason' => ['RefundReason', RefundReason::class],
            'TicketStatus' => ['TicketStatus', TicketStatus::class],
            'ValidationMethod' => ['ValidationMethod', ValidationMethod::class],
            'SeatingMode' => ['SeatingMode', SeatingMode::class],
            'VehicleType' => ['VehicleType', VehicleType::class],
            'Locale' => ['Locale', Locale::class],
        ];
    }

    /** @param class-string $enum */
    #[DataProvider('enums')]
    public function test_php_enums_match_the_openapi_contract(string $schema, string $enum): void
    {
        $expected = self::contractValues($schema);
        $actual = array_map(
            static fn (\BackedEnum $case): string|int => $case->value,
            $enum::cases(),
        );

        sort($expected);
        sort($actual);

        $this->assertSame(
            $expected,
            $actual,
            "L'énumération {$enum} a dérivé de `{$schema}` dans docs/openapi.yaml. ".
            'La spécification est normative : aligner PHP dessus, pas l\'inverse.',
        );
    }

    /** @return list<string> */
    private static function contractValues(string $schema): array
    {
        static $spec = null;

        if ($spec === null) {
            $path = base_path('../../docs/openapi.yaml');
            self::assertFileExists($path, 'Contrat OpenAPI introuvable.');

            /** @var array<string, mixed> $spec */
            $spec = Yaml::parseFile($path);
        }

        /** @var array{components: array{schemas: array<string, array{enum?: list<string>}>}} $spec */
        $values = $spec['components']['schemas'][$schema]['enum'] ?? null;

        self::assertIsArray($values, "Le schéma `{$schema}` n'existe pas ou ne porte pas d'énumération.");

        return $values;
    }
}
