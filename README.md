# MOTOBOY

Plateforme de mobilité pour le marché camerounais : rechercher, comparer,
réserver, payer, obtenir un billet électronique.

La conception est documentée dans [`docs/`](docs/) :

| Document | Ce qu'il porte |
|---|---|
| [BRIEF.md](docs/BRIEF.md) | Les décisions **et leur raisonnement** — à lire avant de contourner l'une d'elles |
| [ROADMAP.md](docs/ROADMAP.md) | Ce qui est fait, ce qui reste, dans quel ordre et pourquoi |
| [SCHEMA.md](docs/SCHEMA.md) | Le modèle de données et ses garde-fous |
| [openapi.yaml](docs/openapi.yaml) | Le contrat d'API, **normatif** |
| [CODING-STANDARD.md](docs/CODING-STANDARD.md) | Comment écrire le code, et où les principes ne s'appliquent pas ici |

---

## Structure

```text
motoboy/
├── apps/
│   ├── api/                 Laravel — hors du workspace pnpm
│   ├── web/                 React + Vite + TS
│   │                        public · passager · agence · propriétaire · admin
│   └── mobile/              Expo React Native — passager
├── packages/
│   ├── api-client/          types générés + client typé
│   ├── shared/              domaine sans UI : formatage, libellés, jetons
│   └── tsconfig/            configurations communes
├── docs/
└── scripts/
```

**L'API Laravel vit dans le dépôt mais hors du workspace JS.** Composer la
gère, pnpm l'ignore — l'exclusion est explicite dans `pnpm-workspace.yaml`.
Une seule PR peut ainsi modifier un endpoint, le type généré et les deux
clients.

## Prérequis

Node ≥ 20 · pnpm 10 · PHP ≥ 8.2 · Composer 2

## Démarrer

```bash
docker compose up -d
```

```bash
pnpm install
pnpm api:types
```

Postgres écoute sur **5433** et Redis sur **6380** — les ports par défaut sont
souvent déjà pris par une instance locale, et le conflit se manifeste par des
erreurs d'authentification déroutantes plutôt que par un refus franc.

| Commande | Effet |
|---|---|
| `pnpm web` | Application web en développement |
| `pnpm mobile` | Expo |
| `pnpm api:types` | Regénère les types depuis `docs/openapi.yaml` |
| `pnpm typecheck` | Vérifie tous les packages |
| `pnpm verify` | Pureté de `shared` + typecheck — à lancer en CI |

L'API se lance à part, depuis `apps/api` :

```bash
php artisan migrate && php artisan serve
```

**Les tests backend tournent sur PostgreSQL, pas sur SQLite.** Le schéma
s'appuie sur des index uniques partiels et des contraintes de vérification, et
surtout le modèle de verrouillage de SQLite diffère fondamentalement : un test
de double-vente qui y passerait ne prouverait rien sur la production.

## Trois règles à tenir

**1. Le contrat OpenAPI est normatif.** `docs/openapi.yaml` est la source de
vérité entre les trois applications. Les types de `@motoboy/api-client` en
sont générés et **ne sont jamais édités à la main** ; l'implémentation Laravel
est vérifiée contre lui, pas l'inverse.

**2. `@motoboy/shared` ne porte jamais de règle métier.** Le backend est la
source de vérité pour la disponibilité, le prix final, le statut d'une
réservation et la validité d'un billet. `shared` porte du formatage, des
libellés et des jetons. Le jour où l'on y recalcule des frais d'annulation, la
règle existe en deux exemplaires et elles divergeront.

**3. `@motoboy/shared` n'a aucune dépendance DOM ni React Native.** Metro
imposant `node-linker=hoisted`, pnpm ne cloisonne plus les dépendances : un
package peut importer ce qu'il n'a pas déclaré, et l'erreur n'apparaîtrait
qu'à l'exécution, côté mobile. D'où `pnpm check:shared`.

Les types du contrat sont exposés séparément du client HTTP —
`@motoboy/api-client/types` — précisément pour que `shared` puisse les
consommer sans hériter de la dépendance DOM du client.

## Pas de package d'interface partagé

shadcn repose sur Radix et le DOM : les composants mobiles sont écrits
séparément. Seuls les **jetons de design** voyagent, depuis
`@motoboy/shared/tokens`.
