<?php

declare(strict_types=1);

namespace App\Modules\Identity\Rules;

/**
 * Le format d'un numéro de téléphone, en un seul endroit.
 *
 * **Il était recopié en sept exemplaires, et deux avaient divergé.** `login`,
 * `register`, `resend` et `verify` exigeaient l'international ; l'inscription
 * d'une agence et la création d'un agent se contentaient de `string|max:20`.
 * Les deux créent pourtant un compte — et `AgencyStaffController` va jusqu'à
 * retrouver l'existant par `where('phone', ...)`, si bien que deux formats du
 * même numéro y désignent deux personnes distinctes.
 *
 * Ce que produisait l'écart : une agence s'inscrivait avec `651212331`, recevait
 * son code — puis la vérification le refusait sur le format. Le compte existait,
 * portait un numéro qu'aucune connexion n'accepterait, et rien à l'écran ne
 * disait quoi corriger. Le SMS était bien parti ; c'est le numéro lui-même qui
 * ne pouvait plus servir.
 *
 * Une règle unique ne rend pas ces points d'entrée plus stricts : elle rend
 * impossible qu'ils cessent de s'accorder.
 *
 * Ne s'applique qu'aux numéros **qui ouvrent une session ou reçoivent un
 * code**. Celui d'un chauffeur ou d'un accompagnant reste libre : on l'appelle,
 * on ne s'y authentifie pas, et l'imposer refuserait des saisies utiles sans
 * rien protéger.
 *
 * Bornes volontairement **larges** (E.164 : 8 à 15 chiffres, indicatif
 * compris). Le serveur juge la forme, jamais l'existence — seul l'envoi du code
 * établit qu'un numéro est joignable.
 */
final class PhoneNumber
{
    public const PATTERN = '/^\+[1-9][0-9]{7,14}$/';

    /**
     * `max:20` double la borne du motif : la colonne fait vingt caractères, et
     * une validation qui laisse passer ce que la base refuse produit un 500 là
     * où un 422 était dû.
     *
     * @return list<string>
     */
    public static function rules(): array
    {
        return ['required', 'string', 'max:20', 'regex:'.self::PATTERN];
    }
}
