<?php

declare(strict_types=1);

namespace App\Modules\Payments\Contracts;

use App\Modules\Payments\Data\GatewayCharge;
use App\Modules\Payments\Data\PaymentIntent;
use App\Modules\Payments\Data\WebhookEvent;

/**
 * Port de l'agrégateur de paiement.
 *
 * **Exprimé en vocabulaire métier, jamais en vocabulaire de prestataire** (§7 du
 * brief). C'est ce qui permet de construire tout le parcours de paiement sans
 * que l'agrégateur soit choisi : le code métier ne connaît aucun nom de
 * fournisseur, et l'ajout d'un adaptateur ne change aucun appelant.
 *
 * Le prestataire reste à choisir, sur la grille de capacités éliminatoires de
 * [B4](../../../../../docs/BRIEF.md) — remboursement et décaissement par API en
 * tête.
 */
interface PaymentGateway
{
    /**
     * Lance un encaissement.
     *
     * **Asynchrone par nature** : le passager reçoit une sollicitation sur son
     * téléphone et doit saisir son code. Le résultat est donc `PENDING` ou
     * `PROCESSING`, jamais un succès immédiat — c'est le webhook qui tranche.
     */
    public function charge(PaymentIntent $intent): GatewayCharge;

    /**
     * Interprète une notification entrante.
     *
     * Renvoie `null` si la charge utile n'est pas exploitable : un webhook
     * illisible se journalise et s'ignore, il ne fait pas tomber l'endpoint —
     * les prestataires réémettent, et un 500 déclencherait une tempête de
     * rejeux.
     *
     * @param  array<string, list<string|null>>  $headers
     */
    public function parseWebhook(string $payload, array $headers): ?WebhookEvent;

    /** Identifiant du prestataire, tel que stocké dans `payments.provider`. */
    public function name(): string;
}
