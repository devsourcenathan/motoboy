<?php

declare(strict_types=1);

use App\Modules\Identity\Console\CreateAdminCommand;
use App\Modules\Payments\Console\ConfirmPaymentCommand;
use App\Modules\Payouts\Console\BuildDriverPayoutsCommand;
use App\Modules\Rides\Console\ApproveDriverCommand;
use App\Support\Http\RendersApiErrors;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    /*
     * Déclarées une par une : la découverte automatique ne scrute que
     * `app/Console/Commands`, et les commandes vivent ici dans leur module.
     */
    ->withCommands([
        CreateAdminCommand::class,
        ConfirmPaymentCommand::class,
        ApproveDriverCommand::class,
        BuildDriverPayoutsCommand::class,
    ])
    ->withMiddleware(function (Middleware $middleware): void {
        /*
         * Derrière le proxy de l'hébergeur.
         *
         * Sans cela, deux choses cassent silencieusement : les URL générées
         * repassent en `http` alors que le trafic est en HTTPS, et surtout
         * **l'adresse enregistrée au journal d'audit devient celle du proxy**.
         * §28 demande de savoir d'où une opération a été faite ; une colonne
         * remplie de la même IP interne ne répond plus à la question.
         *
         * `'*'` est correct ici parce que l'application n'est joignable qu'à
         * travers le proxy de l'hébergeur : rien n'atteint le conteneur
         * directement.
         */
        $middleware->trustProxies(at: '*');

        /*
         * Aucune redirection vers un écran de connexion : il n'y en a pas.
         *
         * Par défaut, le middleware d'authentification redirige un visiteur non
         * authentifié vers `route('login')` dès que la requête ne réclame pas
         * explicitement du JSON. Sur une API sans route `login`, cela lève une
         * `RouteNotFoundException` **avant** que la couche de traduction
         * n'intervienne : le client reçoit un 500 opaque là où le contrat promet
         * un 401 `UNAUTHENTICATED`.
         *
         * Le cas ne se voyait pas en test parce que les assistants `getJson` et
         * `postJson` posent l'en-tête `Accept` ; un client qui l'oublie, lui, ne
         * l'oublie qu'une fois.
         */
        $middleware->redirectGuestsTo(fn (): ?string => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Toute erreur de l'API porte un code typé du contrat : les clients
        // branchent dessus et composent eux-mêmes le texte affiché, dans la
        // langue de l'utilisateur.
        $exceptions->render(
            fn (Throwable $e, Request $request) => RendersApiErrors::render($e, $request),
        );
    })->create();
