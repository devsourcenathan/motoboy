<?php

declare(strict_types=1);

namespace App\Support\Http;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Throwable;

/**
 * Traduit les exceptions en enveloppe d'erreur du contrat.
 *
 * Sans cette couche, Laravel renvoie `{message, errors}` : un client ne pourrait
 * pas distinguer une place déjà prise d'une fenêtre de vente fermée autrement
 * qu'en analysant du texte français.
 *
 * Ce qui n'est pas reconnu ici n'est **pas** transformé : une erreur imprévue
 * doit ressembler à une erreur imprévue, pas être déguisée en échec métier.
 */
final class RendersApiErrors
{
    public static function render(Throwable $e, Request $request): ?JsonResponse
    {
        if (!$request->is('api/*') && !$request->expectsJson()) {
            return null;
        }

        return match (true) {
            $e instanceof ApiException => self::respond($e->errorCode, $e->getMessage(), $e->details),

            $e instanceof ValidationException => self::validation($e),

            $e instanceof AuthenticationException => self::respond(
                ErrorCode::Unauthenticated,
                'Jeton absent ou invalide.',
            ),

            $e instanceof AuthorizationException => self::respond(
                ErrorCode::Forbidden,
                'Permission insuffisante pour la ressource demandée.',
            ),

            $e instanceof ModelNotFoundException,
            $e instanceof NotFoundHttpException => self::respond(
                ErrorCode::NotFound,
                'Ressource introuvable.',
            ),

            $e instanceof TooManyRequestsHttpException => self::respond(
                ErrorCode::RateLimited,
                'Trop de requêtes.',
                array_filter(['retry_after' => $e->getHeaders()['Retry-After'] ?? null]),
            ),

            default => null,
        };
    }

    /** @param array<string, mixed> $details */
    private static function respond(ErrorCode $code, string $message, array $details = []): JsonResponse
    {
        $body = ['code' => $code->value, 'message' => $message];

        if ($details !== []) {
            $body['details'] = $details;
        }

        return response()->json($body, $code->status());
    }

    private static function validation(ValidationException $e): JsonResponse
    {
        return response()->json([
            'code' => ErrorCode::ValidationFailed->value,
            'message' => 'Corps de requête invalide.',
            'errors' => $e->errors(),
        ], ErrorCode::ValidationFailed->status());
    }
}
