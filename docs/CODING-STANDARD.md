# MOTOBOY — Standard de code

> Ce document sert à trancher, pas à sermonner. Chaque règle est là parce
> qu'elle empêche un défaut identifié dans ce produit — pas parce qu'elle
> figure dans un livre.
>
> Ce qui peut être outillé l'est. Le reste se tient en revue.

---

## 1. Les principes, et surtout leurs limites

KISS, DRY et YAGNI sont utiles jusqu'au moment où on les applique
mécaniquement. Les cas ci-dessous sont ceux de **ce** projet, où la lecture
naïve du principe casse une décision prise volontairement.

### DRY — distinguer l'instantané de la redondance

> **Test à appliquer : si la source change, la copie doit-elle changer aussi ?**
> Si oui, c'est une redondance à supprimer. Si non, c'est un instantané à
> conserver.

Le schéma duplique délibérément des données. Ce ne sont pas des violations de
DRY :

| Duplication                                      | Pourquoi elle est correcte                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conditions commerciales recopiées sur `bookings` | Modifier un taux de commission ne doit **jamais** réécrire l'historique des réservations passées, déjà reversées et déjà justifiées à l'agence ([B4](BRIEF.md)) |
| `trips.origin_city_id` et `destination_city_id`  | Copiés depuis la route à la génération. La recherche est la requête centrale du produit ; la jointure serait payée à chaque appel                               |
| `trips.had_confirmed_bookings_at_cancellation`   | Figé à l'annulation, car les réservations passent ensuite en `CANCELLED_BY_AGENCY` et l'information serait perdue ([I1](BRIEF.md))                              |
| `booking_passengers.trip_id`                     | Nécessaire à l'index unique partiel : les deux colonnes doivent vivre dans la même table                                                                        |

**Le mauvais DRY, celui qui fait vraiment mal ici** : partager une règle métier
entre le backend et les clients. Le backend est la source de vérité pour la
disponibilité, le prix final, le statut d'une réservation et la validité d'un
billet ([§29](BRIEF.md)). Recalculer des frais d'annulation dans
`@motoboy/shared` créerait deux implémentations de la même règle, et elles
divergeront — c'est une question de temps, pas de discipline.

C'est pour cela que `GET /v1/bookings/{reference}/cancellation-quote` existe :
le client **demande** le montant, il ne le calcule pas.

### KISS — la simplicité est celle du lecteur, pas celle du schéma

L'inventaire des places utilise **deux mécanismes différents** selon le type de
véhicule : index unique partiel en mode `SEATED`, verrou de ligne plus
contrainte de capacité en mode `CAPACITY`. C'est asymétrique, donc en apparence
moins simple qu'un mécanisme unique.

Un mécanisme unique aurait imposé de matérialiser une ligne par siège et par
départ — environ 12 600 lignes par liaison et par mois dont la quasi-totalité
ne serait jamais vendue. Chaque cas utilise le mécanisme qui lui convient : le
code est plus court, et le système plus compréhensible.

De même, **les garde-fous en base font doublon avec les vérifications
applicatives**, volontairement. Si la logique métier se trompe, la base refuse
l'écriture au lieu de double-vendre. Sur un produit où la double-vente se
traduit par un passager debout devant un car complet, la redondance vaut son
coût.

### YAGNI — sauf quand le rattrapage coûte une migration

Deux choses sont dans le schéma sans usage immédiat :

- la table `countries`, alors que le MVP est mono-pays ;
- les coordonnées GPS des gares, alors qu'aucune carte n'est affichée.

Elles ne sont pas de la spéculation : leur ajout a posteriori coûterait une
migration sur des données en production, alors que leur présence coûte une
colonne. **Le critère n'est pas « en aura-t-on besoin » mais « combien coûtera
le rattrapage ».**

Inversement, tout ce qui est listé en [§31](BRIEF.md) reste dehors, y compris
quand c'est tentant.

---

## 2. Langue

| Élément                                                                     | Langue       |
| --------------------------------------------------------------------------- | ------------ |
| Identifiants — classes, méthodes, variables, tables, colonnes, champs d'API | **Anglais**  |
| Commentaires et docblocks                                                   | **Français** |
| Messages destinés à l'utilisateur                                           | **Français** |
| Messages de commit                                                          | **Anglais**  |
| Documentation dans `docs/`                                                  | **Français** |

Les identifiants suivent les conventions de Laravel et de TypeScript, qui sont
anglaises ; s'en écarter produirait du `$reservationCount` à côté de
`created_at`. Les commentaires expliquent des décisions métier prises en
français — les traduire perdrait en précision.

**Un commentaire dit _pourquoi_, jamais _quoi_.** Le code dit déjà ce qu'il
fait. Un commentaire qui paraphrase la ligne suivante est du bruit qui se
périme.

---

## 3. Règles transverses

### Montants

- **Jamais de flottant.** Les montants sont des entiers, en unités entières de
  devise. Le XAF n'a pas de subdivision en circulation.
- Un montant voyage **toujours avec sa devise**. Jamais un entier nu dans une
  signature.
- Le **formatage est un affaire de client**. Le backend renvoie
  `{ amount, currency }`, jamais `"6 500 FCFA"`.
- Toute opération sur des montants qui traverse plusieurs enregistrements est
  **dans une transaction**.

### Dates et heures

- Stockage en `timestamptz`, **toujours en UTC**.
- Transport en **ISO 8601** avec fuseau.
- Conversion au fuseau du pays **au moment de l'affichage uniquement**.
- L'heure d'un `schedule` est une heure locale de type `time` — c'est une heure
  de pendule, pas un instant.
- **Aucune échéance métier n'est décidée côté client.** Un compte à rebours qui
  atteint zéro n'annule rien : il invite à redemander l'état au serveur.

### Identifiants

- Les `id` internes ne sortent **jamais** dans une URL, une réponse publique
  ou une interface.
- Tout ce qui est exposé passe par sa `reference` publique. Un identifiant
  séquentiel visible révélerait le volume d'affaires.

### Énumérations

La spécification OpenAPI est normative. Une énumération y est définie une fois,
et :

- côté TypeScript, elle est **générée** — jamais réécrite ;
- côté PHP, elle est écrite comme `enum` adossée à une chaîne, et **un test
  vérifie qu'elle correspond exactement à la spécification**.

Ce test n'est pas une formalité : c'est le seul point du système où une
énumération existe en deux exemplaires, donc le seul endroit où elle peut
diverger.

### Erreurs

- Toute erreur porte un **code typé**. Un message seul est inexploitable par un
  client — l'écran d'embarquement doit distinguer cinq cas, pas afficher
  « invalide ».
- Le `message` est destiné à l'affichage et peut changer sans préavis ; le
  `code` est du contrat.
- Ajouter un cas d'échec, c'est **ajouter un code dans la spécification**, pas
  détourner un code existant.

### Idempotence

- Les opérations qui créent de l'argent ou de l'inventaire acceptent une clé
  d'idempotence, et la respectent.
- **Un job en file doit pouvoir être rejoué sans effet supplémentaire.** Les
  files réessaient, c'est leur métier.
- Les webhooks sont dédupliqués sur `(provider, event_id)`.

---

## 4. Backend — Laravel

### Organisation

Le monolithe est **modulaire** ([§6](BRIEF.md)). Les modules sont physiques,
pas seulement conceptuels : une structure plate rendrait théorique la promesse
d'extraire un service plus tard.

```text
app/Modules/Bookings/
├── Actions/          un cas d'usage par classe
├── Models/
├── Http/
│   ├── Controllers/
│   ├── Requests/
│   └── Resources/
├── Jobs/
├── Enums/
└── Events/
```

**Un module ne parle à un autre que par ses Actions ou ses événements**, jamais
en instanciant ses modèles directement. C'est ce qui permettra d'en extraire un
sans dérouler tout le reste.

### Actions

Un cas d'usage, une classe, une méthode publique.

```php
final class CreateBooking
{
    public function handle(CreateBookingData $data): Booking { /* … */ }
}
```

- L'Action **détient la transaction**. Ni le contrôleur ni le modèle.
- Elle est testable sans requête HTTP.
- Si elle dépasse une centaine de lignes, elle fait probablement deux choses.

Nos décisions se lisent déjà comme une liste d'Actions : `CreateBooking`,
`InitiatePayment`, `ConfirmPayment`, `ReleaseExpiredHolds`, `CancelTrip`,
`RefundBooking`, `SyncTicketValidations`, `GenerateTrips`, `BuildPayout`,
`ApprovePayout`.

### Contrôleurs

Fins, sans exception. Un contrôleur valide, appelle une Action, renvoie une
ressource. **Aucune règle métier, aucune requête Eloquent non triviale, aucune
transaction.**

Si un contrôleur dépasse une vingtaine de lignes par méthode, la logique est au
mauvais endroit.

### Modèles

Relations, casts, scopes. Rien d'autre.

Un modèle qui sait calculer une commission est un modèle qu'on ne peut plus
tester sans base de données, et une règle qu'on retrouvera dupliquée ailleurs.

### Requêtes et validation

- La validation d'entrée vit dans une `FormRequest`, jamais dans le contrôleur.
- Les colonnes typées par une énumération sont castées en `enum` PHP. Une
  chaîne libre finit toujours par contenir une valeur qui n'existe pas.

### Transactions et concurrence

- Toute opération touchant l'inventaire ou l'argent est **atomique**.
- Les garde-fous en base ne sont pas décoratifs : le code doit **traiter la
  violation de contrainte**, pas la laisser remonter en 500. Une prise de siège
  concurrente est un cas nominal, pas une panne.
- Le verrou est pris pour la durée la plus courte possible, et jamais autour
  d'un appel réseau.

### Pièges Laravel

- **`env()` uniquement dans `config/`.** Ailleurs, il renvoie `null` dès que la
  configuration est mise en cache — panne classique, silencieuse, en
  production seulement.
- Pas de requête dans une boucle. Le chargement anticipé n'est pas une
  optimisation, c'est le défaut.
- Les événements de modèle ne portent pas de logique métier : ils sont
  invisibles à la lecture et ingérables en test.

---

## 5. Frontend — TypeScript

### Types

- **`any` est interdit.** Ce qui est inconnu est `unknown`, puis affiné.
- Les types de l'API viennent de `@motoboy/api-client`. **Ne jamais
  redéclarer** une forme qui existe dans le contrat : c'est exactement la
  dérive que le langage unique devait supprimer.
- Les libellés d'énumération sont typés `Record<Union, string>`. Ajouter une
  valeur à la spécification casse alors la compilation tant que le libellé
  manque — c'est voulu.

### Frontière avec le métier

- **Aucun calcul de règle métier.** Les frais d'annulation, la disponibilité,
  le prix final et la validité d'un billet se demandent au serveur.
- Ce que le client peut faire seul : formater, ordonner un affichage, calculer
  un temps restant à titre indicatif.

### Packages partagés

- `@motoboy/shared` : formatage, libellés, jetons. **Aucune dépendance DOM ni
  React Native**, vérifié par `pnpm check:shared`.
- Un consommateur qui n'a besoin que des types importe
  `@motoboy/api-client/types`, pas le client complet — sans quoi la dépendance
  DOM refuit.
- **Pas de package de composants partagé.** shadcn repose sur Radix et le DOM ;
  seuls les jetons voyagent.

### Erreurs

Brancher sur `code`, jamais sur `message` ni sur le statut HTTP seul.

```ts
if (error) {
  setMessage(errorCodeLabels[error.code])
  return
}
```

---

## 6. Tests

**Pas d'objectif de couverture.** Une exigence uniforme produit des tests
décoratifs sur les CRUD et détourne l'attention des endroits dangereux.

En revanche, cette liste est **obligatoire**. Ce sont les endroits où un défaut
coûte de l'argent réel ou un passager débarqué :

| Ce qui doit être testé                                                        | Le défaut évité                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| Deux réservations concurrentes du même siège                                  | Double-vente — un passager debout devant un car complet |
| `seats_taken` ne peut pas dépasser `capacity`                                 | Surréservation en mode capacité                         |
| Expiration d'un hold libère bien les places                                   | Inventaire gelé par des paiements abandonnés            |
| Un échec de paiement **ne libère pas** les places                             | Le passager qui recompose son code perd son siège       |
| Rejeu d'une clé d'idempotence                                                 | Double réservation, double paiement                     |
| Rejeu d'un webhook                                                            | Double confirmation                                     |
| Répartition des frais d'annulation                                            | Montant erroné reversé à une agence                     |
| Frais d'annulation **inférieurs** aux frais d'agrégateur                      | Montant négatif réclamé à une agence                    |
| Modifier les conditions d'une agence n'altère pas les réservations existantes | Réécriture rétroactive de l'historique financier        |
| Transitions interdites de la machine à états                                  | Réservation confirmée sans paiement                     |
| Validation en double hors ligne                                               | Doublon rejeté au lieu d'être tracé                     |
| Parité des énumérations entre la spécification et PHP                         | Dérive du contrat                                       |
| Conformité de l'implémentation à `openapi.yaml`                               | La spécification cesse d'être normative                 |

Ailleurs, on teste ce qui a cassé une fois, et ce qu'on ne saurait pas vérifier
à la main.

**Un test nommé décrit le comportement attendu**, pas la méthode appelée :
`it_releases_seats_when_the_hold_expires`, pas `test_release_method`.

---

## 7. Outillage

Un standard non outillé se dégrade en trois semaines. Ce qui suit est vérifié
automatiquement.

| Outil          | Portée                               | Commande            |
| -------------- | ------------------------------------ | ------------------- |
| Laravel Pint   | Formatage PHP                        | `composer format`   |
| Larastan       | Analyse statique PHP, **niveau 8**   | `composer analyse`  |
| Pest / PHPUnit | Tests backend                        | `composer test`     |
| TypeScript     | Typage strict, tous packages         | `pnpm typecheck`    |
| oxlint         | Lint TypeScript                      | `pnpm lint`         |
| Prettier       | Formatage TypeScript, YAML, Markdown | `pnpm format`       |
| Script maison  | Pureté de `@motoboy/shared`          | `pnpm check:shared` |

`pnpm verify` enchaîne les vérifications JS. La CI lance l'ensemble, PHP
compris.

**Larastan est au niveau 8 dès le départ.** Le projet est vierge : il n'y a
aucune dette à absorber, et descendre d'un niveau est plus facile que d'en
monter un.

---

## 8. Ce qu'on regarde en revue

Ce que l'outillage ne voit pas :

1. **La règle métier est-elle au bon endroit ?** Backend pour tout ce qui
   décide, client pour tout ce qui affiche.
2. **Cette duplication est-elle un instantané ou une redondance ?** Appliquer
   le test de la section 1.
3. **Le cas concurrent est-il traité comme nominal ?** Une violation de
   contrainte unique n'est pas une panne.
4. **Le commentaire explique-t-il pourquoi ?** Sinon il se périmera.
5. **Cette nouveauté est-elle dans le périmètre ?** [§31](BRIEF.md) liste ce
   qui reste dehors, y compris quand c'est tentant.
6. **Une décision du brief est-elle contournée ?** Si elle gêne, on la rouvre
   explicitement et on met le document à jour — on ne la contourne pas dans le
   code.
