<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Contracts\Database\Query\Expression;
use Illuminate\Support\Facades\DB;

/**
 * Fuseau d'affichage, utilisable dans du SQL.
 *
 * **Pourquoi ne pas passer le fuseau en paramètre lié.** PostgreSQL considère
 * deux placeholders distincts comme deux expressions distinctes : un
 * `GROUP BY (departure_at at time zone $1)::date` ne correspond alors plus au
 * `SELECT (departure_at at time zone $2)::date`, et la requête échoue sur une
 * erreur de regroupement difficile à relier à sa cause.
 *
 * **Pourquoi une liste blanche plutôt qu'une validation par expression
 * régulière.** Le constructeur de requêtes n'accepte que des `literal-string`
 * dans ses méthodes brutes, précisément pour qu'une chaîne composée à
 * l'exécution ne puisse pas s'y glisser. Une liste blanche satisfait cette
 * contrainte sans la contourner — et elle est plus solide : seuls des fuseaux
 * explicitement prévus peuvent atteindre SQL, quelle que soit la valeur
 * effectivement configurée.
 *
 * Ajouter un pays revient à ajouter une branche ici.
 */
final class DisplayTimezone
{
    /**
     * Le fuseau configuré, sous forme de littéral SQL déjà entre apostrophes.
     *
     * @return literal-string
     */
    public static function sqlLiteral(): string
    {
        return match (config('app.display_timezone')) {
            'Africa/Douala' => "'Africa/Douala'",
            'UTC' => "'UTC'",
            default => throw new \RuntimeException(
                'Fuseau non prévu pour un usage SQL : ajouter une branche à DisplayTimezone.',
            ),
        };
    }

    /**
     * L'instant ramené à l'heure locale — `(departure_at at time zone 'Africa/Douala')::date`.
     *
     * @param  literal-string  $column
     * @param  literal-string  $suffix  Cast appliqué au résultat, par exemple `::date`
     */
    public static function localExpression(string $column, string $suffix = ''): Expression
    {
        return DB::raw('('.$column.' at time zone '.self::sqlLiteral().')'.$suffix);
    }

    /**
     * Même expression, nommée — pour un `SELECT` dont la colonne est ensuite
     * reprise dans un `GROUP BY`.
     *
     * @param  literal-string  $column
     * @param  literal-string  $suffix
     * @param  literal-string  $alias
     */
    public static function localExpressionAs(string $column, string $suffix, string $alias): Expression
    {
        return DB::raw('('.$column.' at time zone '.self::sqlLiteral().')'.$suffix.' as '.$alias);
    }
}
