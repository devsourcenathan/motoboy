<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Contracts;

use App\Modules\Payouts\Data\DisbursementEvent;
use App\Modules\Payouts\Data\DisbursementIntent;
use App\Modules\Payouts\Data\GatewayDisbursement;

/**
 * Port de décaissement vers les agences.
 *
 * **Distinct de `PaymentGateway`, délibérément.** Encaisser auprès d'un passager
 * et verser à une agence sont deux opérations sans rapport dans le domaine, et
 * rien ne dit qu'elles passeront par le même prestataire : le décaissement vers
 * Mobile Money est une capacité à part dans la grille de sélection de
 * [B4](../../../../../docs/BRIEF.md), et une agence de transfert peut très bien
 * la couvrir sans faire d'encaissement. Les fondre imposerait à tout adaptateur
 * d'implémenter les deux.
 */
interface PayoutGateway
{
    /**
     * Envoie les fonds.
     *
     * Asynchrone comme le reste : la réponse est `PROCESSING`, et le sort réel
     * du transfert arrive ensuite. Un pilote qui renverrait un succès immédiat
     * laisserait écrire du code incapable de gérer un décaissement en attente —
     * or c'est précisément l'état où un second reversement ne doit pas partir.
     */
    public function disburse(DisbursementIntent $intent): GatewayDisbursement;

    /**
     * Interprète une notification de décaissement.
     *
     * Elle est ce qui fait sortir un reversement de `PROCESSING`. Un reversement
     * en vol interdisant d'en construire un second, sans cet état terminal
     * l'agence ne serait plus jamais payée.
     *
     * Renvoie `null` sur une charge inexploitable : elle se journalise et
     * s'ignore, elle ne fait pas tomber l'endpoint.
     *
     * @param  array<string, list<string|null>>  $headers
     */
    public function parseWebhook(string $payload, array $headers): ?DisbursementEvent;

    /** Identifiant du prestataire, tel que stocké sur le reversement. */
    public function name(): string;
}
