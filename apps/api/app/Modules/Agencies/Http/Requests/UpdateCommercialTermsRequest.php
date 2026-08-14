<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Bornes des paramètres commerciaux (B4).
 *
 * **Elles étaient écrites dans le brief et vérifiées nulle part.** Trois d'entre
 * elles sont volontairement fermées et n'apparaissent donc pas comme des
 * options :
 *
 * 1. **Reverser avant le départ est exclu** — d'où un délai minimum de zéro
 *    heure *après* le départ, jamais négatif : c'est la seule configuration qui
 *    crée une créance irrécupérable, un remboursement survenant après un
 *    versement Mobile Money ne se récupérant que par la bonne volonté de
 *    l'agence.
 * 2. **Le passager ne peut pas porter les frais d'agrégateur** — d'où
 *    `PLATFORM` ou `AGENCY`, et rien d'autre. Le prix affiché divergerait du
 *    prix guichet, et un comparateur qui n'affiche pas le vrai prix perd sa
 *    raison d'être.
 * 3. **Les frais d'annulation plafonnent à 50 %** du montant payé : une agence
 *    ne peut pas rendre une réservation intégralement non remboursable à
 *    l'intérieur de sa propre fenêtre d'annulation.
 */
final class UpdateCommercialTermsRequest extends FormRequest
{
    /** Les pourcentages sont en points de base : 5000 vaut 50 %. */
    private const MAX_CANCELLATION_FEE_BASIS_POINTS = 5000;

    public function authorize(): bool
    {
        // L'autorisation est portée par `AdminContext` dans le contrôleur : elle
        // dépend d'une permission globale, pas de la requête.
        return true;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'commission_type' => ['sometimes', 'string', 'in:PERCENTAGE,FIXED'],
            'commission_value' => ['sometimes', 'integer', 'min:0', 'max:10000'],

            'fee_bearer' => ['sometimes', 'string', 'in:PLATFORM,AGENCY'],

            'payout_delay_hours' => ['sometimes', 'integer', 'min:0', 'max:168'],
            'payout_frequency' => ['sometimes', 'string', 'in:WEEKLY,MONTHLY'],
            'payout_day' => ['sometimes', 'integer', 'min:1', 'max:28'],
            'payout_minimum_amount' => ['sometimes', 'integer', 'min:0'],

            'counter_sale_commission_enabled' => ['sometimes', 'boolean'],
            'counter_sale_sms_enabled' => ['sometimes', 'boolean'],

            'cancellation_deadline_hours' => ['sometimes', 'integer', 'min:0', 'max:48'],
            'cancellation_fee_type' => ['sometimes', 'string', 'in:PERCENTAGE,FIXED'],
            'cancellation_fee_value' => [
                'sometimes', 'integer', 'min:0',
                'max:'.self::MAX_CANCELLATION_FEE_BASIS_POINTS,
            ],

            'hold_duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:30'],
            'online_sales_cutoff_minutes' => ['sometimes', 'integer', 'min:0', 'max:240'],
        ];
    }

    /**
     * Seuls les champs fournis sont modifiés : une mise à jour partielle ne doit
     * pas remettre les autres à leur valeur par défaut.
     *
     * @return array<string, mixed>
     */
    public function changes(): array
    {
        /** @var array<string, mixed> $validated */
        $validated = $this->validated();

        return $validated;
    }
}
