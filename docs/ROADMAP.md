# MOTOBOY — Reste à faire

> **Ce document ne contient ni dates ni estimations.** L'ordre est contraint par
> les dépendances techniques, pas par un calendrier : la taille de l'équipe et sa
> disponibilité ne sont pas connues, et inventer des durées produirait une
> fiction dont personne ne se servirait.
>
> Il se périme si on ne le tient pas à jour. L'état des lieux est donc adossé à
> ce qui se vérifie par commande, pas à ce dont on se souvient.
>
> **Dernière mise à jour** — 13 août 2026

---

## 1. État des lieux

Tout ce qui suit est vérifiable : `pnpm verify` à la racine, `composer check`
dans `apps/api`.

| Chantier | État | Vérification |
|---|---|---|
| Décisions produit | 6 points bloquants et 10 points importants tranchés | [BRIEF.md](BRIEF.md) |
| Modèle de données | 33 tables, garde-fous de concurrence éprouvés | [SCHEMA.md](SCHEMA.md) · 22 migrations |
| Contrat d'API | tous les espaces — 61 chemins, 68 opérations | couverture vérifiée par test, liste d'attente vide |
| Monorepo | pnpm, Laravel hors workspace, chaîne de génération éprouvée | `pnpm verify` |
| Standard de code | outillé : Pint, Larastan 8, Prettier, oxlint, CI | [CODING-STANDARD.md](CODING-STANDARD.md) |
| Référentiel | 26 villes, alias, rôles et permissions, idempotent | `php artisan db:seed` |
| Modèles Eloquent | 35 modèles, exercés contre le vrai schéma | `composer check` |
| **Recherche** | 4 endpoints publics, éprouvés de bout en bout | 51 tests, 156 assertions |
| **Authentification** | inscription, OTP, session Sanctum, port SMS | idem |
| **Réservation** | prise de places atomique, tenue, libération planifiée | idem |
| **Paiement** | port agrégateur, initiation, webhook, commission et compte courant | idem |
| **Billet et QR** | émission par passager, charge signée, consultation | idem |
| **Embarquement** | liste, synchronisation par élément, secours manuel, portée par agence | idem |
| **Back-office — inventaire** | gares, véhicules, chauffeurs, itinéraires, horaires, génération | idem |
| **Vente au guichet** | appel unique, encaissement espèces, billets immédiats, rejeu sûr | idem |
| **Annulation et remboursement** | partielle ou totale, départ annulé, répartition des frais, rejeu | idem |
| **Reversements** | solde du compte courant, validation humaine, décaissement, réconciliation | idem |
| **Administration** | inscription et validation d'agence, coordonnées vérifiées, audit, référentiel, tableau de bord | idem |
| **Déploiement** | image Docker, blueprint Render, base Neon, R2 pour les documents | 167 tests, 594 assertions · image construite et exercée |

**Ce qui n'existe pas encore** : les interfaces. **Toute la chaîne est en place
côté API** — une agence s'inscrit, est validée, alimente son inventaire, vend en
ligne et au comptoir, embarque, annule, et est reversée sur des coordonnées
vérifiées. Restent les écrans web et mobile, la PWA d'embarquement, et les
listes de consultation de l'administration.

---

## 2. Décisions qui ne dépendent pas du code

Ces points ne se règlent pas en écrivant du logiciel. Le dernier entièrement
ouvert — l'hébergement — est tranché ; ceux qui restent portent sur des
prestataires, pas sur le développement.

| Sujet | État | Ce qu'il bloque |
|---|---|---|
| **Agrégateur de paiement** | grille de sélection prête en [B4](BRIEF.md) | L'intégration réelle du paiement. *Pas* le développement — voir l'abstraction ci-dessous |
| **Cadre réglementaire CEMAC** | ouvert, à poser à un conseil local | Une réponse défavorable remettrait en cause l'encaissement centralisé, donc `agency_ledger_entries`, `payouts` et `payout_lines` |
| **Liste des villes** | seedée, **non validée sur le terrain** | La pertinence de la recherche au lancement |
| **Fournisseur SMS** | ✅ **TechSoft SMS** — documentation derrière authentification, à récupérer | L'adaptateur concret, pas le port ni le reste du développement |
| **Stockage objet** | ✅ **Cloudflare R2**, compatible S3 | Rien — l'API S3 est standard |
| **Push mobile** | ✅ **Firebase Cloud Messaging** | Rien à court terme |
| **Hébergement et déploiement** | ✅ **Render** (Docker) + **Neon** (PostgreSQL) | Rien — voir [DEPLOIEMENT.md](DEPLOIEMENT.md) |

**Point ouvert sur TechSoft** : `app.techsoft-sms.com/developers/docs` répond
`401` sans session. Le schéma exact des requêtes — authentification, noms de
paramètres, forme des réponses, existence d'un rappel de statut de livraison —
reste à obtenir avant d'écrire l'adaptateur.

**Cela ne bloque pas.** Le port `SmsSender` est défini indépendamment, et un
pilote de journalisation permet de développer l'inscription par OTP sans
prestataire. Changer de fournisseur ou en ajouter un revient alors à écrire une
classe et à changer une ligne de configuration — c'est exactement ce
qu'exigeait [§29](BRIEF.md).

**L'abstraction déverrouille le reste.** [§29](BRIEF.md) exige que le code métier
ne dépende d'aucun fournisseur précis pour le paiement, le SMS, l'email et le
stockage. Cette règle, écrite pour la maintenabilité, sert aussi ici : on
développe contre l'abstraction avec un pilote factice, et le choix du
prestataire cesse d'être bloquant.

---

## 3. Chemin critique

L'ordre suit les dépendances réelles. [§35](BRIEF.md) dit que le MVP doit
valider le parcours **recherche → comparaison → réservation → paiement → billet
→ voyage** : c'est ce parcours qu'on construit, dans cet ordre.

### 3.1 Recherche — ✅ fait

`SearchTrips`, `SuggestAlternatives`, `AutocompletePlaces`, plus les quatre
endpoints publics du contrat.

Un enseignement à garder : `routes_served` **n'exclut pas** la destination
demandée. Le cas qui fait le plus mal n'est pas « cette destination n'existe
pas » mais « elle existe, mais pas à la date choisie » — et une recherche à
date lointaine ne remonte alors aucune date proche. Sans cette inclusion, le
passager repart les mains vides sur un axe desservi tous les jours.

### 3.2 Authentification — ✅ fait

Inscription, OTP, session Sanctum, et le port `SmsSender` avec son pilote de
journalisation — ce qui a permis de tout construire sans attendre la
documentation de TechSoft.

Deux enseignements à garder :

**Une exception levée depuis une transaction annule ce qu'elle voulait
enregistrer.** L'incrément du compteur de tentatives partait avec le
`rollback` : la limite de quatre tentatives de [§8](BRIEF.md) ne limitait rien,
et un attaquant disposait d'essais illimités sur un code à six chiffres. Toute
Action qui compte un échec doit lever **hors** de sa transaction.

**La limitation de débit protège le budget autant que le compte.** Chaque
demande de code envoie un SMS payant, et l'OTP est le seul canal sans
alternative ([I8](BRIEF.md)).

Reste à écrire : l'adaptateur TechSoft, dès que sa documentation est
accessible.

### 3.3 Réservation et tenue des places — ✅ fait

`CreateBooking` et `ReleaseExpiredHolds`, plus les deux endpoints du contrat.

Deux enseignements à garder :

**Un test de concurrence peut mentir.** La première version ouvrait une
transaction, tentait la prise concurrente, puis validait — un interblocage :
la seconde connexion attendait la fin de la première, qui attendait son
retour. Il a fallu un `lock_timeout` pour rendre le blocage observable au lieu
de l'attendre.

**Et il peut être intermittent si l'on sur-spécifie.** Exiger l'erreur `55P03`
rendait le test aléatoire : selon l'instant exact de l'insertion, PostgreSQL
renvoie soit une expiration d'attente, soit une violation d'unicité. Les deux
prouvent la même chose — un siège ne peut pas être pris deux fois — et c'est
cela que le test doit affirmer.

Le job de libération tourne à la minute, sans chevauchement — sa fréquence *est* la durée maximale d'indisponibilité fantôme acceptée en [B2](BRIEF.md).

### 3.4 Paiement — ✅ fait

`InitiatePayment`, `ConfirmPayment`, `RefundPayment` et
`RecordBookingSettlement`, derrière le port `PaymentGateway`. Le prestataire
n'est toujours pas choisi et **cela n'a bloqué à aucun moment** : le pilote
factice reproduit le trait qui compte — rien n'est encaissé de façon synchrone.

Trois points à garder :

**Le pilote factice ne renvoie jamais de succès immédiat.** Un pilote complaisant
laisserait écrire du code incapable de gérer le vrai Mobile Money, où le
passager doit saisir son code pendant une à deux minutes.

**Le webhook répond toujours 204, même en échec.** Les prestataires réémettent :
un 500 sur une charge illisible déclencherait une tempête de rejeux sans jamais
résoudre le problème. Ce qui n'a pas pu être traité reste dans le journal, avec
son erreur.

**Les pourcentages sont en points de base.** 800 vaut 8 % : un entier
interdirait 8,5 %, un flottant ferait entrer de l'arrondi dans un calcul
d'argent.

Reste à écrire : l'exécution effective du remboursement auprès du prestataire,
qui dépend de son API — critère éliminatoire de la grille de [B4](BRIEF.md). Les
remboursements sont créés en `PENDING` et attendent, plutôt que d'afficher un
succès simulé.

### 3.5 Billet et QR Code — ✅ fait

`IssueTickets`, appelée depuis la confirmation de paiement, et `QrPayload` pour
la charge encodée. Format `MTB1:<référence>:<signature>`.

Deux points à garder :

**L'appareil de l'agent ne vérifie pas la signature.** Ce serait tentant, mais
il faudrait distribuer la clé sur chaque téléphone : un appareil volé
permettrait alors de forger des billets pour **toutes** les agences. Hors ligne,
l'autorité reste la liste d'embarquement pré-téléchargée — appartenir à la liste
est ce qui fait foi ([B3](BRIEF.md)). La signature sert côté serveur.

**Le préfixe de version n'est pas décoratif.** Un passager peut avoir capturé
son billet une semaine avant son voyage : le jour où le format changera, il
faudra distinguer un ancien billet d'une charge corrompue.

L'API renvoie le **contenu à encoder**, jamais une image : le client regénère le
QR localement, sans quoi le billet dépendrait du réseau au moment précis où il
n'y en a pas ([I5](BRIEF.md)).

### 3.6 Embarquement — ✅ côté API

`BuildBoardingList`, `SyncTicketValidations`, plus les trois endpoints du
contrat et l'**autorisation par agence**, qui n'existait pas encore : le rôle
`AGENT` était en base, rien ne le faisait respecter.

Un enseignement que [B3](BRIEF.md) ne disait pas : **un renvoi n'est pas un
doublon**. B3 décide qu'une double validation hors ligne est signalée et non
bloquée — deux agents ont scanné le même billet, c'est une anomalie. Mais un
appareil qui synchronise, perd la réponse et resynchronise fait le même geste,
pas un second. Sans les distinguer, chaque coupure réseau fabriquerait un faux
doublon, et la statistique censée révéler un vrai problème d'exploitation
deviendrait du bruit. D'où la colonne `client_id`, absente du schéma initial.

Reste à écrire : **la PWA** — service worker, cache de la liste, file locale des
validations. L'API qu'elle consomme est en place.

### 3.7 Annulation et remboursement — ✅ côté API

`CancellationTerms`, `CancelBooking`, `CancelTrip`, `ConfirmRefund`,
`RetryFailedRefunds`, plus les quatre endpoints du contrat.

**La répartition de [B5](BRIEF.md) est le point délicat, et elle est vérifiée au
franc près.** MOTOBOY renonce à sa commission — elle rémunère un transport qui
n'a pas eu lieu — mais récupère ses frais réels d'agrégateur sur les frais
d'annulation retenus ; le solde revient à l'agence, qui subit la perte du siège.
Si les frais retenus sont inférieurs aux frais réels, MOTOBOY absorbe la
différence.

Le compte courant se corrige **par contre-passation, jamais par réécriture** :
le crédit et le débit d'origine restent en place, sans quoi un relevé déjà envoyé
à l'agence cesserait de correspondre à ses lignes.

Quatre choses que l'écriture a révélées :

- **Le coût réel du remboursement n'est pas connu à l'annulation.** Il n'arrive
  qu'avec la confirmation du prestataire. Il vient donc en écriture séparée,
  plafonnée par ce que les frais retenus n'ont pas déjà couvert — d'où la
  colonne `refunds.fee_amount`, plutôt qu'une soustraction reconstituée après
  coup qui cesserait d'être vraie au premier remboursement non lié à une
  annulation.
- **Le port de paiement n'avait pas de `refund()`.** Les remboursements
  seraient restés `PENDING` à vie, et le « rejeu automatique puis alerte » de B5
  n'aurait rien eu à appeler. Le port l'expose désormais, et le webhook
  distingue les deux flux par le **type de retour** de `parseWebhook` — un champ
  « type » à interpréter chez l'appelant n'aurait fait que déplacer le problème.
- **Un remboursement partait deux fois.** `RefundPayment::handle()` enregistrait
  *et* exécutait, et l'appelant réexécutait hors transaction : deux demandes au
  prestataire pour un seul remboursement. `record()` et `execute()` sont
  désormais séparés, et `handle()` ne sert qu'aux appelants sans transaction
  ouverte.
- **`bookings.user_id` est réellement nullable** — vente au comptoir. L'analyse
  statique le déduisait présent depuis le type de la relation ; une annotation
  le dit maintenant, et le SMS d'annulation ne casse plus sur un passager de
  guichet.

⚠️ **Un point où [B5](BRIEF.md) et le contrat divergent.** B5 écrit « au-delà du
délai, non remboursable », ce qui parle d'argent et laisserait l'annulation
possible à zéro franc — le siège repartirait à la vente. Le contrat, lui, liste
`CANCELLATION_DEADLINE_PASSED` en 409. Le contrat étant normatif, c'est lui qui
tranche : l'annulation tardive est refusée. Relâcher cette borne se décide dans
la spécification.

**Reporté** : la modification importante du voyage ([B5](BRIEF.md)-C — décalage
de plus de 30 minutes, changement de date ou de gare, ouvrant droit à annulation
gratuite). Elle suppose un endpoint de **modification** de départ, que le lot
back-office n'a pas construit : il couvre la création et la génération, pas
l'édition. À écrire en même temps que celle-ci, plutôt qu'à moitié maintenant.

### 3.8 Reversements — ✅ côté API

`EligibleBalance`, `BuildPayout`, `BuildDuePayouts`, `ApprovePayout`,
`SendPayout`, `ConfirmPayout`, `ReconcilePayments`, plus les endpoints agence et
administration.

**Un reversement n'est qu'une opération de solde du compte courant jusqu'à une
date donnée.** La somme du compte fait foi pour le net ; le brut, la commission
et les remboursements n'en sont qu'une décomposition destinée au relevé — et si
elle ne se recompose pas exactement, l'action refuse d'écrire plutôt que de
proposer un montant injustifiable devant l'agence.

Le débit est écrit **à l'envoi**, pas à la confirmation : sans cela, un
reversement construit pendant que le précédent est en vol verrait un solde encore
entier et paierait deux fois. Un échec le contre-passe. Une écriture arrivée
tardivement — un remboursement postérieur — est reprise au reversement suivant, et
un solde négatif se reporte : **la dette suit l'agence** au lieu de disparaître.
C'est précisément ce pour quoi le compte courant a été préféré à un calcul par
période.

Trois choses que l'écriture a révélées :

- **Les écritures ne disaient pas à quelle réservation elles se rapportaient.**
  `reference_type`/`reference_id` désignent l'objet écrit — une commission, un
  remboursement —, pas la réservation. Déterminer l'éligibilité en comparant ces
  identifiants aurait fait correspondre une commission à une réservation portant
  le même numéro. D'où `agency_ledger_entries.booking_id`, et un `null` qui
  signifie exactement « reversable sans attendre un départ ».
- **Un reversement restait `PROCESSING` sans fin.** Comme un reversement en vol
  interdit d'en construire un second, l'agence n'aurait plus jamais été payée. Il
  fallait un état terminal : d'où `ConfirmPayout` et
  `POST /v1/webhooks/payouts/{provider}`.
- **Trois codes d'erreur n'avaient pas de libellé** dans `@motoboy/shared`. Le
  typage du catalogue l'a signalé au premier `pnpm verify` — c'est ce pour quoi
  il est typé.

Le port de décaissement est **distinct** de celui d'encaissement : verser à une
agence et encaisser auprès d'un passager sont deux capacités séparées dans la
grille de [B4](BRIEF.md), et une agence de transfert peut couvrir la seconde sans
faire la première. Les fondre imposerait à tout adaptateur d'implémenter les deux.

La **réconciliation quotidienne** confronte le relevé du prestataire aux
paiements enregistrés, dans les deux sens : sans elle, « le passager a payé mais
n'a pas de billet » ne se découvre que par réclamation. Elle **ne corrige rien** —
confirmer un paiement sur la foi d'un relevé émettrait un billet sans avoir vu le
webhook, et un relevé erroné se propagerait en billets.

⚠️ **Le seuil minimum de reversement vaut `0` par défaut**, alors que
[B4](BRIEF.md) demande « au moins 10× le coût unitaire d'un décaissement ». Il est
infixable tant que l'agrégateur n'est pas choisi : le mécanisme est en place et
testé, la valeur attend le prestataire.

**Ouvre partiellement l'administration.** Quatre opérations sous `/v1/admin/…` —
lister, calculer, approuver, envoyer. Sans elles le circuit financier ne se
referme jamais. Le reste de l'espace d'administration reste à construire.

---

## 4. Sans quoi rien n'est cherchable

Le chemin critique ci-dessus est celui du passager. Mais **une agence doit
pouvoir alimenter l'inventaire**, sinon la recherche ne renvoie rien et le
produit n'existe pas.

### Chaîne d'inventaire — ✅ fait

Gares, véhicules avec plan de sièges généré, chauffeurs, itinéraires, horaires
récurrents et `GenerateTrips`, planifié quotidiennement. Un test suit la chaîne
entière : d'une agence sans rien jusqu'à un départ que la recherche renvoie.

L'**autorisation par agence** est portée par `AgencyContext`, et une ressource
d'une autre agence répond `NOT_FOUND` et non `FORBIDDEN` : dire « interdit »
confirmerait son existence et permettrait d'énumérer le parc d'un concurrent.

### Vente au guichet — ✅ côté API

`CreateCounterSale` : un seul appel fait la prise de places, la réservation
**directement confirmée**, le paiement `CASH`, les billets et le SMS. Le critère
est la vitesse — une saisie plus lente que le cahier ne serait pas faite, et
toute la fiabilité de la disponibilité affichée s'effondrerait avec elle
([I2](BRIEF.md)).

Le flux d'argent est **l'inverse** de celui d'une vente en ligne, et c'est le
point le plus facile à se tromper : aucun crédit au compte courant, puisque
l'agence a encaissé elle-même. Créditer puis reverser lui paierait une seconde
fois ce qu'elle a déjà. Commission activée, c'est elle qui **doit** — d'où un
`COUNTER_COMMISSION_DEBIT` seul, déduit du prochain reversement.

Deux points que l'écriture a révélés :

- **Le rejeu n'était pas géré côté guichet.** La clé d'idempotence remontait
  jusqu'à l'index d'unicité et produisait une erreur serveur, laissant l'agent
  incapable de dire si l'argent qu'il tient correspond à une vente enregistrée.
  Le SMS n'est pas renvoyé sur un rejeu.
- **`created_by` restait vide.** La colonne existait pour l'agent ; une vente en
  espèces dont on ignore qui l'a encaissée ne se réconcilie pas avec la caisse.

Le plan de sièges est désormais **une seule règle** partagée entre la vue
publique et celle du guichet — le jour où change ce qui rend une place
indisponible, les deux changent ensemble. Le guichet en voit une colonne de
plus, l'échéance des places tenues : le hold l'emporte sur le comptoir, mais
l'agent doit distinguer « vendue » de « tenue, se libère dans six minutes ».

### Reste à faire

- Écrans de suivi : tableau de bord, réservations, reversements, personnel

Le lot 2 du contrat est écrit, et un **test de couverture** compare désormais
les routes enregistrées aux chemins spécifiés, dans les deux sens. Il a été
introduit après avoir constaté la dérive : treize routes servies sans figurer au
contrat, quatre chemins spécifiés sans exister. C'est ce qui rend le mot
« normative » vrai plutôt qu'aspirationnel.

---

## 4 bis. Administration — ✅ côté API

`RegisterAgency`, `ReviewAgency`, `ManagePayoutAccount`, `UpdateCommercialTerms`,
`AdjustLedger`, `ResolveCityRequest`, `RecordAudit`, plus le port de stockage et
le tableau de bord.

**Le maillon manquant du circuit financier est posé.** Une agence déclare ses
coordonnées de reversement, mais elles naissent **non vérifiées** et
n'encaissent rien : c'est un administrateur qui les vérifie, l'opération est
journalisée avec ancienne et nouvelle valeur, et l'agence est prévenue **sur le
contact qu'elle avait avant la demande** — notifier le nouveau numéro
n'avertirait que l'auteur du changement, c'est-à-dire l'attaquant dans le seul
scénario qui compte ([B4](BRIEF.md)).

Valider une agence et vérifier ses coordonnées restent **deux gestes distincts** :
l'un dit « cette entreprise existe », l'autre « cet argent peut partir là ».

Trois choses que l'écriture a révélées :

- **L'`AuditLog` était spécifié et rien n'écrivait dedans.** La table et le
  modèle existaient depuis le début du schéma ; aucune ligne n'y était jamais
  passée, alors que [§28](BRIEF.md) l'exige et que B4 en fait une obligation sur
  les coordonnées de reversement. L'enregistreur est appelé **explicitement**
  depuis les Actions sensibles, pas posé en observateur Eloquent : un
  observateur voit qu'une ligne a changé, pas qui l'a changée ni depuis où, et
  noierait les gestes humains sous les écritures des jobs.
- **`User::hasRole()` était cassé dès qu'on lui passait une agence.** Le
  `wherePivot` était appelé depuis la closure d'un `when`, où l'argument reçu
  est le Builder et non la relation : le `__call` le transformait en condition
  sur une colonne « pivot » inexistante. La méthode n'avait jamais été appelée
  avec ce second argument — le premier test à le faire l'a fait tomber.
- **Les bornes de [B4](BRIEF.md) n'étaient vérifiées nulle part.** Délai
  d'éligibilité 0–168 h, frais d'annulation plafonnés à 50 %, porteur des frais
  jamais le passager : elles étaient écrites dans le brief et rien ne les
  imposait. Elles le sont maintenant côté serveur.

Le **port de stockage** arrive avec ce lot, parce que les documents d'agence en
avaient besoin. Le disque local sert le développement, Cloudflare R2 la
production — compatible S3, donc le même adaptateur couvre les deux et le
changement tient dans une ligne de configuration. Le nom d'origine d'un fichier
n'est jamais repris : il vient de l'utilisateur, et deux agences déposant
« licence.pdf » s'écraseraient.

**Ce qui reste de [§23](BRIEF.md)** : les listes de consultation — utilisateurs,
véhicules, chauffeurs, propriétaires, trajets, réservations, billets,
transactions, commissions. Ce sont des écrans sans décision, qui se construisent
mieux une fois qu'on sait ce qu'on y cherche ; ils appartiennent au même chantier
que les interfaces.

---

## 4 ter. Déploiement — ✅ fait

**Render** pour l'API, en Docker, et **Neon** pour la base. Recette complète dans
[DEPLOIEMENT.md](DEPLOIEMENT.md) ; l'image a été construite et exercée contre une
base réelle, pas seulement écrite.

**Un seul conteneur sert les trois rôles** — web, file d'attente, planificateur.
Le travail de fond n'est pas accessoire : sans planificateur,
`ReleaseExpiredHolds` ne tourne plus et l'inventaire se gèle, sans qu'aucune
erreur ne le signale.

Deux choses que la construction a révélées :

- **Le manifeste de paquets de la machine de développement partait dans
  l'image.** `bootstrap/cache/packages.php` y liste les paquets *de
  développement* ; copié dans une image installée en `--no-dev`, il fait
  référencer un fournisseur de services absent, et le conteneur meurt au
  démarrage sur « Class not found » avant même d'avoir touché la base.
- **Un appel non authentifié sans en-tête `Accept` renvoyait 500.** Le
  middleware d'authentification redirige vers une route `login` qui n'existe pas
  sur une API, et la `RouteNotFoundException` passe **avant** la couche de
  traduction : le client recevait une erreur opaque là où le contrat promet un
  401 typé. Aucun test ne l'attrapait — `getJson` pose l'en-tête, un vrai client
  l'oublie une fois. Corrigé, et couvert.

**Ce qui n'est pas fait, et qui compte :** aucun prestataire n'est branché — les
pilotes factices restent actifs, donc **rien ne s'encaisse réellement** —, et
[I7](BRIEF.md) reste entier : pas de suivi d'erreurs, pas de supervision des
files, pas de sauvegarde vérifiée. Sur un produit qui encaisse de l'argent et
dépend de webhooks tiers, ces briques sont dites non négociables.

---

## 5. Interfaces

Tout ce qui consomme l'API — écrans web et mobile, PWA d'embarquement — est dans
sa propre feuille de route : **[ROADMAP-FRONT.md](ROADMAP-FRONT.md)**.

---

## 6. Chantiers parallèles

Rien de tout cela ne bloque le chemin critique.

| Chantier | Note |
|---|---|
| Catalogues i18n des applications | i18next côté web et mobile ; `@motoboy/shared` porte déjà le vocabulaire métier |
| Écrans web | shadcn, routage par rôle — seul un écran de vérification existe |
| Navigation mobile | idem |
| Espace propriétaire | consultation seule, sans circuit financier ([I3](BRIEF.md)) |
| Administration | validation des agences, référentiel, reversements, statistiques |
| Observabilité | erreurs, files, journal des webhooks ([I7](BRIEF.md)) — décidé, pas installé |
| Job `no-show` | bascule automatique après le départ, referme la machine à états |
| Taux d'annulation par agence | ne compte que les départs portant des réservations ([I1](BRIEF.md)) |

---

## 7. Ce que « terminé » veut dire

Le MVP est prêt quand ces deux boucles tournent de bout en bout, sur des données
réelles :

**Passager** — il cherche Douala → Bafoussam, compare deux agences, choisit sa
place, paie en Mobile Money, reçoit son billet, et un agent le valide à
l'embarquement, **y compris sans réseau en gare**.

**Agence** — elle publie ses horaires récurrents, ses départs se génèrent seuls,
elle vend au guichet en moins de 30 secondes, elle voit son compte courant et
reçoit son reversement avec un relevé qui tient devant une contestation.

Tant qu'une de ces deux boucles a un trou, le MVP n'est pas lançable — même si
tous les écrans existent.

---

## 8. Hors MVP

La liste fait autorité et se trouve en [§31 du brief](BRIEF.md). Elle inclut
notamment le wallet, les applications chauffeur et agence, le suivi GPS, la
réservation par tronçon, le transfert de réservation et l'alerte de
disponibilité.

Elle est là pour être respectée quand c'est tentant.

**Une exception, assumée et datée.** L'appel de service (§9) rouvre le mode
chauffeur — comme un jeu d'onglets dans l'application existante, pas comme une
seconde application. Le **suivi GPS reste hors périmètre** : la position est
déclarée, jamais captée. La distinction compte, parce que c'est elle qui fait la
différence entre une extension et un second produit.

## 9. Appel de service — extension post-MVP

Décidée le 17 août 2026, spécifiée en [Partie IV du brief](BRIEF.md), détaillée
écran par écran dans [Appel de service](APPEL-DE-SERVICE.md). Un passager demande
un véhicule, des chauffeurs indépendants proposent leurs offres, il choisit.

**L'ordre n'est pas négociable : rien n'a de sens sans chauffeur validé.**

### 9.1 Bénéficiaire généralisé dans les reversements

Le seul point de sortie d'argent est indexé sur `agency_id`. Le généraliser à un
bénéficiaire — agence ou personne — **avant** d'en avoir besoin, plutôt que de
dupliquer un second grand livre.

D'abord parce que c'est le chantier le plus risqué du lot, et que les 177 tests
existants sont le filet qui le rend sûr. Ensuite parce qu'un second grand livre
écrit « en attendant » ne se fusionne jamais.

### 9.2 Chauffeur : compte, dossier, modération

Rôle `DRIVER` sur un `User` ordinaire — connexion par OTP, comme tout le monde.
Profil portant permis, véhicule, documents et compte de reversement. File de
modération dans l'espace administration, sur le modèle des gares.

Aucune course tant que le dossier n'est pas validé.

### 9.3 Module `Rides`

Demandes, offres, courses. Deux index uniques partiels comme garde-fous : un
chauffeur n'a qu'une course active, une demande n'accepte qu'une offre.

### 9.4 Paiement et reversement de la course

Réutilise Paiements ; le reversement passe par le bénéficiaire de 9.1.

### 9.5 Écrans

Côté passager : demander un véhicule, suivre ses offres, choisir. Côté chauffeur :
demandes ouvertes de sa ville, ses courses, ses revenus. Les onglets dépendent du
rôle.

**Passager fait** (17 août 2026) : entrée « Besoin d'un véhicule ? » sur l'accueil,
formulaire de demande — ville du référentiel plus point de repère en texte libre —
et un écran de suivi unique qui couvre toute la vie de la demande : attente,
comparaison des offres, paiement, absence du chauffeur. Sondage à dix secondes,
arrêté dès que plus rien ne peut arriver ; pas de canal temps réel à ce stade.

Trois champs manquaient au contrat pour que cet écran ne devine rien — le nom de la
ville, l'état payé de la course, le chauffeur d'une offre. Corrigés côté API avant
d'écrire l'écran, plutôt que compensés côté mobile. Détail et suite dans
[Suivi de l'appel de service](SUIVI-APPEL-DE-SERVICE.md).

**Chauffeur fait** (17 août 2026), sauf ses revenus : bascule depuis le profil,
dossier avec dépôt des quatre pièces, demandes ouvertes de sa ville, offre à prix
ferme, course à démarrer et terminer. Pas de sondage sur les demandes — il ouvre
l'écran quand il cherche du travail, et tire pour rafraîchir.

Les cinq réponses de liste de cette extension déclaraient un `200` sans schéma ;
elles divergeaient aussi de l'enveloppe de pagination du reste de l'API et deux
d'entre elles tronquaient à cinquante lignes en silence. Corrigé, et tenu par un
test : toute réponse de succès autre que `204` doit déclarer un corps.

En écrivant l'écran du chauffeur, une fuite : le téléphone du chauffeur partait
dans la réponse dès l'acceptation, la règle « seulement une fois payé » n'étant
tenue que par l'écran. Elle est passée dans la ressource.

Même nature, tranché ensuite : `start()` refuse une course impayée en 409
`RIDE_NOT_PAID`. Une course pouvait se dérouler entièrement sans qu'un franc ait
bougé, et le règlement de fin créditait le chauffeur d'un argent jamais encaissé.

Ses revenus et son compte de reversement suivent : solde, reversable, détail des
écritures, historique des virements, et la déclaration Mobile Money — inactive
jusqu'à vérification par un administrateur. Le solde et le reversable sont deux
nombres distincts à l'écran : une course terminée il y a une heure compte au
premier et pas au second.

### 9.6 Reversement du chauffeur — ✅ fait

**24 h de délai, 5 000 F de minimum, réglables au dashboard** comme la commission
(`RidePayoutTerms`). Une agence négocie ses conditions ; un chauffeur indépendant ne
négocie pas, donc les valeurs valent pour tous.

`BuildDriverPayout` est une action à part de `BuildPayout`, pour la même raison que
`PayForRide` l'est d'`InitiatePayment` : réglages au lieu de conditions négociées,
fin de course au lieu de départ programmé, relevé par course au lieu de réservation.

Il a fallu finir la généralisation : `payouts.agency_id` devient nullable — `payee_id`
existait déjà, c'est l'agence obligatoire qui bloquait — et `payout_lines` accepte une
course, exclusive d'une réservation par contrainte de base.

**Ce qui reste, et qui n'est plus cette extension :** l'application web n'existe pas
— deux fichiers. La file de modération n'est pas un écran à ajouter mais une
application à amorcer. Et aucun virement ne part réellement tant qu'une passerelle
de versement n'est pas choisie.

### Ce qui n'en fait pas partie

Carte, suivi de course, négociation, notation, push. Le push est la seule
infrastructure réellement neuve que cette extension appellera — plus tard, quand
consulter la liste ne suffira plus.
