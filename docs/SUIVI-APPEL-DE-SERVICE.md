# Appel de service — suivi

*Où en est le chantier. Décisions en [Partie IV du brief](BRIEF.md),
fonctionnalités et écrans dans [Appel de service](APPEL-DE-SERVICE.md), ordre de
construction en [§9 de la roadmap](ROADMAP.md).*

**Dernière mise à jour : 17 août 2026.**

## État d'ensemble

| Étape | État |
|---|---|
| 0. Spécification | ✅ fait |
| 1. Bénéficiaire généralisé des reversements | ✅ fait — contraction à finir |
| 2. Compte chauffeur, dossier, modération | ✅ fait — côté API |
| 3. Module `Rides` — demandes, offres, courses | ✅ fait — côté API |
| 4. Paiement et reversement de la course | ✅ fait, reversement compris |
| 5. Écrans passager | ✅ fait |
| 6. Écrans chauffeur | ✅ fait |
| 7. Écrans administration (web) | ⬜ |

---

## 1. Bénéficiaire généralisé des reversements

**Pourquoi en premier.** C'est le seul point de sortie d'argent de la plateforme,
et il est indexé sur `agency_id`. Le généraliser maintenant, pendant que les
tests existants servent de filet, plutôt que d'écrire « en attendant » un second
grand livre qui ne se fusionnera jamais.

- [x] Recenser ce qui suppose une agence dans `Payouts`
- [x] Introduire le bénéficiaire (agence **ou** personne) — table `payees`
- [x] Migrer le grand livre sans perdre d'historique — reprise des agences
- [x] Les tests existants passent sans modification de leurs attentes — 177/177
- [ ] **Phase de contraction** : les appelants passent le bénéficiaire eux-mêmes,
      puis retrait du pont dans les modèles et de `agency_id` des deux tables

**Où on en est.** `payees` existe, avec une contrainte de base qui accorde le
genre et la cible : un `DRIVER` porte un utilisateur et pas d'agence, un `AGENCY`
l'inverse. Grand livre et reversements portent un `payee_id` obligatoire,
renseigné pour tout l'historique.

Le remplissage passe encore par un **pont dans les modèles**, qui dérive le
bénéficiaire de l'agence à la création. C'est délibérément transitoire : dériver
une colonne en silence se tient le temps d'une migration, pas durablement. Il
fallait éviter de toucher au schéma et aux six actions qui comptent l'argent dans
le même mouvement.

**Règle du chantier :** aucun test existant ne doit changer d'attente. S'il en
faut un, c'est que le comportement a bougé, et ce n'est pas ce qu'on veut.

## 2. Compte chauffeur

- [x] Rôle `DRIVER` — sans permission, comme le passager
- [x] Schéma : `driver_profiles` et `driver_documents`
- [x] Modèles, énumérations, garde-fous en base
- [x] Endpoints : dépôt du dossier, lecture de son statut
- [x] Dépôt et remplacement de pièces via `FileStorage`
- [x] File de modération, validation et refus **motivé**
- [x] Suspension sans perte d'historique ni de reversements dus
- [x] Contrat mis à jour, client typé régénéré

**Où on en est.** Le dossier existe et porte ses invariants en base : un dossier
par personne, une pièce par type, et **un refus sans motif est refusé par la
base** — un chauffeur qui ne sait pas quoi corriger est un chauffeur perdu.

`canDrive()` exige un dossier validé **et** un permis non périmé : la date est
saisie au dépôt et personne ne repasse derrière, donc sans ce contrôle une
validation d'il y a deux ans laisserait rouler indéfiniment.

Le véhicule vit sur le dossier, pas dans `vehicles` : celui-là appartient à une
agence, se voit affecter des départs et porte un plan de sièges.

## 3. Module `Rides`

- [x] `service_requests` — demande, expiration
- [x] `ride_offers` — prix ferme, délai annoncé, validité
- [x] `rides` — course acceptée
- [x] Index unique partiel : une course active par chauffeur
- [x] Index unique partiel : une offre acceptée par demande
- [x] Expiration des demandes sans offre
- [x] Onze endpoints, contrat et client typé régénéré

## 4. Paiement et reversement

- [x] Schéma : un paiement peut porter sur une course
- [x] Contrainte : un paiement sans objet, ou rattaché aux deux, est refusé
- [x] Compteur de non-présentations au dossier chauffeur
- [x] Encaissement à l'acceptation — `PayForRide`, avec rejeu par clé
- [x] Écriture au grand livre du chauffeur — crédit et commission séparés
- [x] Grand livre ouvert aux écritures sans agence
- [x] Endpoints HTTP de paiement et de signalement d'absence
- [x] Remboursement : annulation avant départ, et chauffeur absent
- [x] Grand livre et remboursements ouverts aux courses
- [x] Contrat mis à jour, client typé régénéré
- [x] Comptes de versement ouverts aux personnes — table et modèle renommés
- [x] **Une passe de reversement pour un chauffeur** — `BuildDriverPayout`

### Ce qui reste avant qu'un chauffeur touche son argent

Toute la chaîne est généralisée : écritures, remboursements, et désormais la
destination du virement. `agency_payout_accounts` est devenue `payout_accounts`,
et le modèle a quitté le module Agences pour Reversements — le renommer plutôt
que le compléter, parce qu'un nom qui affirme le contraire de ce qu'il contient se
propage au prochain lecteur.

Reste à faire **fonctionner une passe de reversement pour un bénéficiaire
personne**. Je l'ai tentée le 17 août et je l'ai annulée : ce n'est pas de la
plomberie, contrairement à ce que j'avais annoncé.

`BuildPayout` et `BuildDuePayouts` lisent le **délai** et le **minimum** de
versement dans les `commercialTerms` de l'agence — conditions négociées, portées
par B4. Un chauffeur indépendant n'en a aucune, et il ne négocie pas.

**Tranché le 17 août 2026**, et construit :

| Question | Décision |
|---|---|
| **Délai** avant qu'une course soit reversable | **24 h** — le même défaut que les agences. Zéro se défendait, la course étant finie, mais un remboursement demandé après le virement ne se récupère que par la bonne volonté du chauffeur |
| **Minimum** de versement | **5 000 F**, environ une course. Verser 500 F coûte plus de frais qu'il n'en rapporte ; ce seuil reste atteignable en une journée |
| **Réglables** comme la commission | **Oui** — `RidePayoutTerms`, sur le mécanisme `PlatformSetting`, plafonnés à 168 h et 100 000 F. Ces valeurs se corrigeront quand on saura ce que coûte réellement un virement, et un déploiement par ajustement ferait qu'on ne les ajusterait pas |

### Ce qu'il a fallu construire, et pourquoi ce n'était pas de la plomberie

| Pièce | Raison |
|---|---|
| Migration `payouts.agency_id` nullable | `payee_id` existait depuis l'étape 1 ; c'est `agency_id`, obligatoire lui aussi, qui bloquait. Rien ne pouvait être versé à un chauffeur quel que soit son solde |
| `payout_lines.ride_id` | Une ligne de relevé portait forcément une **réservation**. Un chauffeur n'en a aucune. Les deux cohabitent, exclusives, garanties par un CHECK — et l'unicité passe en index partiels, une colonne nulle échappant à l'unicité en SQL |
| `EligibleRideBalance` | Une réservation devient éligible quand son **départ** est parti ; une course, quand elle est **terminée**. Filtrée sur `completed_at` et non sur le statut : une course annulée après coup garde son horodatage, et c'est le grand livre qui porte le solde réel |
| `BuildDriverPayout`, action à part | Trois choses divergent de `BuildPayout` : réglages au lieu de conditions négociées, fin de course au lieu de départ, relevé par course au lieu de réservation. Les fondre aurait donné une action à deux jeux de gardes exclusifs — deux actions dans un fichier |
| `motoboy:build-driver-payouts` | L'endpoint admin ne balaie que les agences, et personne ne peut encore l'appeler puisque le web n'existe pas. Même rôle que `motoboy:approve-driver` |

**Un défaut trouvé en passant.** `ManagePayoutAccount::verify()` désactivait les
comptes frères par `agency_id` — nul pour un chauffeur, et `agency_id = null` ne
matche rien en SQL. Deux destinations vérifiées auraient coexisté, le reversement
prenant la première venue. La portée passe par `payee_id`, propriétaire depuis
l'étape 1 et valable pour les deux genres.

### Trouvé en testant : le paiement d'une course n'était jamais confirmé

`ConfirmPayment::recordSuccess()` sortait par un `return` muet quand le paiement
n'avait pas de réservation — un `return` écrit quand seules les réservations
existaient. Le webhook renvoyait 200 et **ne touchait rien** : l'argent partait
chez l'agrégateur, le paiement restait `PROCESSING` pour toujours, `paid` ne
basculait jamais, le téléphone du chauffeur n'apparaissait pas et la course ne
pouvait pas démarrer.

**Tout le circuit d'argent de l'appel de service était mort de bout en bout**, et
les 240 tests n'en disaient rien : chacun d'eux marquait le paiement `SUCCEEDED`
directement en base au lieu de passer par le webhook. C'est le raccourci qui
cachait le trou.

Deux autres manques du même coup, tous deux dans ce qui remonte d'un paiement vers
son objet :

| Manque | Effet |
|---|---|
| `Payment::ride()` n'existait pas | Rien ne pouvait aller d'un paiement à sa course |
| `motoboy:confirm-payment` ne résolvait qu'une réservation | Le circuit était intestable en local, donc jamais exercé |

Verrouillé par `test_the_webhook_confirms_a_ride_payment`, qui passe **par le
webhook** et non par un `update` en base.

### Ce qui reste, et qui n'est plus l'appel de service

| Reste | Nature |
|---|---|
| `POST /v1/admin/payouts/build` ne balaie que les agences | Étendre sa portée changerait la forme de sa réponse. À faire avec l'écran qui l'appellera, pas avant |
| File de modération web (étape 7) | **L'application web n'existe pas** — deux fichiers, `App.tsx` et `main.tsx`. Ce n'est pas un écran à ajouter mais une application à amorcer : routeur, session, mise en page, i18n, client d'API. C'est un chantier propre, pas la fin de celui-ci |
| Passerelle de versement réelle | Le port `PayoutGateway` existe avec son pilote factice. Aucun virement ne part vraiment tant qu'un prestataire n'est pas choisi — même point ouvert que l'agrégateur de paiement |

### Deux préalables, tous deux hors du périmètre d'une passe rapide

**1. Généraliser `InitiatePayment`** — ✅ **écarté après examen.** Ses gardes sont
entièrement propres à la réservation : tenue de places expirée, vente en ligne
close, départ annulé. Aucune n'a de sens pour une course. Ne restait en commun que
l'appel à la passerelle, qui est déjà un port. Les fondre aurait produit une
action avec deux jeux de gardes exclusifs — deux actions dans un fichier. D'où
`PayForRide`, à part.

**2. Le taux de commission d'une course** — ✅ **tranché : 10 %, réglable.**
Stocké en base, modifiable depuis le dashboard par le super-administrateur, en
points de base et plafonné à 30 %. Un taux unique s'applique : une agence négocie
ses conditions parce qu'elle pèse dans la négociation, un chauffeur indépendant
ne négocie pas.

## 5 à 7. Écrans

**Décisions du 17 août 2026.**

| Point | Décision |
|---|---|
| Entrée passager | Un **bouton sur l'accueil**, « Besoin d'un véhicule ? ». Pas de cinquième onglet : un appel de service est rare face à une recherche |
| Mode chauffeur | **Bascule dans le profil.** Un chauffeur reste un passager quand il voyage : il garde ses onglets et bascule quand il travaille |
| Maquettes | **Aucune** pour ces écrans. J'extrapole la langue établie — orange pour agir, cartes, filets — en réutilisant les composants existants |
| Validation d'un dossier pour tester | **`motoboy:approve-driver`** — l'espace web n'existe pas, et sans dossier validé aucun écran de chauffeur ne prouve rien |

- [x] Commande de validation, pour débloquer le test de bout en bout
- [x] Passager : entrée sur l'accueil et formulaire de demande
- [x] Passager : suivre, comparer les offres, payer, signaler une absence
- [x] Chauffeur : bascule, dossier, demandes ouvertes, offrir, conduire
- [x] Chauffeur : revenus et compte de reversement
- [ ] Administration web : la vraie file de modération

### Le contrat était insuffisant pour l'écran de suivi — corrigé

Écran tenté le 17 août puis retiré : il était bâti sur des champs que la ressource
ne renvoyait pas. Trois manques, tous côté API, tous corrigés avant de le
reprendre (`67a9bad`).

| Manque | Pourquoi c'était bloquant | Correction |
|---|---|---|
| `origin.city_id` sans **nom de ville** | L'écran affiche « Bafang », pas « 27 ». Résoudre la ville côté mobile ferait une requête de plus pour une donnée que le serveur a déjà en main | `ServiceRequestPlace.city`, chargé par `loadMissing` |
| Aucun indicateur de **paiement** sur la course | L'écran doit savoir s'il faut proposer de payer ou afficher les coordonnées du chauffeur. Le déduire d'une liste de paiements ferait porter au mobile une règle qui est métier | `Ride.paid`, calculé par `Ride::isPaid()` |
| `offer.driver` **facultatif** | Une offre sans chauffeur n'existe pas ; le rendre optionnel oblige chaque écran à gérer un cas impossible | Émis sans `whenLoaded`, et requis au contrat |

Racine commune : `whenLoaded` décrit une relation *réellement* facultative. Sur une
relation toujours présente, il rend le champ optionnel au contrat et le client se
défend contre un état impossible.

### L'écran de suivi

Un seul écran pour toute la vie de la demande, parce que c'est une seule attente :
le trajet en tête, puis ce que l'état permet — patienter, comparer, payer, signaler.

| Choix | Raison |
|---|---|
| **Sondage à 10 s**, arrêté dès que rien ne peut plus arriver | Aucun canal temps réel. Une demande conclue interrogerait sinon le serveur indéfiniment, batterie et forfait compris |
| **Offres masquées** dès qu'une est retenue | Les laisser à l'écran ferait croire qu'on peut encore changer |
| **Téléphone du chauffeur révélé au paiement seulement** | C'est ce que le passager achète. Le livrer avant laisserait s'arranger hors plateforme, donc sans commission ni recours |
| **Absence signalable** sur une course payée et pas encore partie | Avant paiement il n'y a rien à rembourser ; une fois partie, le chauffeur est venu |
| **Clé d'idempotence neuve à chaque tentative** de paiement | Comme pour une réservation. Rejouer la clé après un code erroné renverrait le refus précédent au passager qui vient de saisir le bon — la description du contrat disait l'inverse, elle a été corrigée |

### Cinq réponses muettes, corrigées

`GET /v1/driver/requests` déclarait un `200` **sans schéma**. En cherchant, quatre
autres : `/v1/driver/offers`, `/v1/driver/rides`, `/v1/service-requests` et
`/v1/admin/drivers` — toutes les listes de cette extension. Le client généré n'en
typait rien.

Deux défauts sont sortis avec :

| Défaut | Correction |
|---|---|
| Enveloppe divergente : `{total, per_page}` contre les `{page, per_page, total, last_page}` des huit autres endpoints paginés | Les quatre clés partout, via `PaginationMeta` |
| `driver/offers` et `driver/rides` plafonnés à 50 lignes sans pagination | Paginés. Un plafond tronque en silence : un chauffeur au-delà de cinquante courses perdait le reste sans que rien ne le dise |
| Le nom de ville ajouté la veille coûtait un N+1 — `loadMissing` par enregistrement sur une page de vingt | Villes chargées par la requête ; `loadMissing` redevient un garde-fou |

Garde-fou permanent : `OpenApiCoverageTest` exige désormais un corps sur toute
réponse de succès autre que `204`. La couverture des chemins ne suffisait pas —
les cinq figuraient bien au contrat.

### Écrans chauffeur

Quatre écrans pour les huit lignes de spec qui ont une API derrière elles.

| Écran | Couvre |
|---|---|
| `/driver` | Devenir chauffeur, dossier, statut, pièces (C1–C3) |
| `/driver/apply` | Le formulaire, en dépôt comme en correction (C2) |
| `/driver/requests` | Demandes de sa ville, détail et offre (C4, C5) |
| `/driver/rides` | Ses offres, ses courses, celle qu'il conduit (C6, C7) |

| Choix | Raison |
|---|---|
| **Bascule dans le profil**, pas de cinquième onglet | Un chauffeur reste un passager quand il voyage ; un onglet permanent occuperait la barre de tous les autres |
| **Détail et offre dans la liste** | Une demande porte cinq informations. Le chauffeur compare : le faire naviguer pour lire ce qui tenait à l'écran lui coûte le comparatif |
| **Pas de sondage** sur les demandes (C4) | Il ouvre l'écran quand il cherche du travail. Interroger toutes les dix secondes consommerait son forfait pendant qu'il conduit — il tire pour rafraîchir |
| **Le net affiché, pas le brut** | La commission est prélevée par la plateforme. Afficher le prix payé ferait croire à une retenue surprise au reversement |
| **`expo-image-picker` ajouté** | Sans dépôt de pièces, aucun dossier ne peut être validé. Supporté par Expo Go |

Le dépôt de fichier passe **hors du client généré** : `openapi-fetch` sérialise en
JSON, et un fichier de React Native est un objet `{uri, name, type}` que seul
`fetch` transforme en partie multipart.

### Le contrat de la course était écrit du seul point de vue du passager

`Ride` portait le chauffeur et rien du passager — inutilisable par l'écran du
chauffeur, qui doit savoir qui aller chercher. Trois ajouts :
`passenger`, `commission` et `driver_amount`. Le net vient du serveur : le taux se
règle depuis le dashboard, et 10 % recopié dans le mobile annoncerait un montant
faux le lendemain d'un changement.

**Et une fuite, trouvée en écrivant l'écran.** La règle « le téléphone n'apparaît
qu'une fois payé » était tenue par l'écran seul. Le numéro partait dans la réponse
dès l'acceptation : il suffisait de lire le JSON pour l'avoir sans payer, donc pour
s'arranger hors plateforme — sans commission et sans recours. La règle est passée
dans `RideResource`, et deux tests l'y maintiennent.

Le test du parcours nominal, lui, **ne payait jamais** : il conduisait une course
entière sans qu'un franc ait bougé. Il paie désormais.

### Une course impayée ne démarre plus — tranché le 17 août 2026

`AdvanceRide::start()` acceptait une course impayée, alors que la décision 1
d'E4 bis règle tout à l'acceptation. Il refuse désormais en **409
`RIDE_NOT_PAID`**, code dédié plutôt que `CONFLICT` générique : le client doit
savoir quoi proposer sans lire un message dont la langue n'est pas garantie (I10).

Ce n'était pas seulement théorique. Sans cette garde, une course entière pouvait
se dérouler sans qu'un franc ait bougé, **et le règlement de fin créditait alors
le chauffeur d'un argent que la plateforme n'avait jamais encaissé**. C'est aussi
ce qui donne son sens au remboursement pour absence : il n'y a de course à honorer
que parce qu'elle est payée.

Deux tests devenaient inatteignables par l'API, et gardaient leur valeur ailleurs :

| Test | Ce qu'il devient |
|---|---|
| `test_an_unpaid_ride_credits_nothing` | État posé à la main, action de règlement appelée directement. C'est la deuxième ligne de défense, et la première tomberait sans bruit le jour où une reprise manuelle passerait à côté |
| `test_a_started_ride_can_no_longer_be_paid` | Statut posé directement. Y passer par `start()` exigerait de payer d'abord, et la tentative suivante buterait sur « déjà payée » — le test passerait pour une autre raison que celle qu'il annonce |

Un troisième s'est ajouté : `test_an_unpaid_ride_cannot_start`, la garde elle-même.


Détail dans [Appel de service](APPEL-DE-SERVICE.md). Rien avant que 1 et 2 ne
tiennent : un écran de chauffeur sans chauffeur validé ne prouve rien.

---

## Questions tranchées

Toutes datées du 17 août 2026, détaillées en [E4 bis du brief](BRIEF.md).

| # | Question | Décision |
|---|---|---|
| 1 | Quand encaisse-t-on ? | **Tout à l'acceptation, remboursable** |
| 2 | Coût d'une annulation après acceptation | **Gratuite avant le départ, rien rendu après** |
| 3 | Chauffeur absent | **Remboursement intégral et marque au dossier** |
| 4 | Attente avant de choisir une offre | **Aucune : retenable dès l'arrivée** |

### Encore ouverte

| # | Question | Défaut en place |
|---|---|---|
| 5 | Portée de « sa ville » | Égalité stricte avec la ville de départ |

Ce défaut suffit au lancement. L'élargir demande une table de villes voisines,
donc une décision produit et une migration — pas un réglage.

## Risques portés

| Risque | Nature | État |
|---|---|---|
| Plus de tiers responsable en cas d'incident | Juridique et commercial | ⬜ à porter au client |
| Autorisations de transport des chauffeurs | Réglementaire | ⬜ à porter au client |
| Refonte du code d'argent | Technique | 🔨 couvert par les tests existants |

## Journal des décisions

| Date | Décision |
|---|---|
| 17 août 2026 | Chauffeurs **indépendants**, pas personnel d'agence |
| 17 août 2026 | Position **déclarée** — ville et point de repère, jamais de GPS |
| 17 août 2026 | L'argent **passe par la plateforme**, puis est reversé au chauffeur |
| 17 août 2026 | Le prix vient d'une **offre du chauffeur**, pas d'un barème |
| 17 août 2026 | Une seule application mobile, onglets selon le rôle |
| 17 août 2026 | Encaissement **intégral à l'acceptation**, remboursable |
| 17 août 2026 | Annulation **gratuite avant le départ**, rien rendu après |
| 17 août 2026 | Chauffeur absent : remboursement intégral **et marque au dossier** |
| 17 août 2026 | Aucune fenêtre d'attente avant de retenir une offre |
| 17 août 2026 | Entrée passager par un **bouton sur l'accueil** |
| 17 août 2026 | Mode chauffeur par **bascule dans le profil** |
| 17 août 2026 | Pas de maquettes : extrapolation du système établi |
| 17 août 2026 | Une course **impayée ne démarre pas** — 409 `RIDE_NOT_PAID` |
| 17 août 2026 | Reversement chauffeur : **24 h**, **5 000 F**, réglables au dashboard |
| 17 août 2026 | Le webhook confirme aussi un paiement de course — il l'ignorait |

---

## 7. Espace d'administration (A1–A4)

| Écran | État |
| --- | --- |
| A1 File des dossiers | ✅ `apps/web` — quatre onglets, du plus ancien au plus récent |
| A2 Instruire un dossier | ✅ pièces manquantes nommées ; valider inerte tant qu'il en manque une |
| A3 Suspendre un chauffeur | ✅ motif obligatoire, lu par le chauffeur |
| A4 Consulter demande et course | ✅ référence SRV- **ou** RID-, lecture seule |
| Vérifier un compte de versement | ✅ — sans lui, `NO_VERIFIED_ACCOUNT` et personne n'est payé |

### Ce que la construction a révélé

| Trouvé | Conséquence |
| --- | --- |
| `/v1/me` ne disait pas le rôle | Aucun client ne pouvait router dessus. `User.roles` ajouté — **au pluriel**, un compte en cumulant plusieurs, avec une portée par agence que le contrat n'expose pas |
| `verifyAccount` exigeait `agencies.approve` | Un compte de chauffeur n'a pas d'agence : la permission suit désormais le propriétaire du compte, sans quoi aucun chauffeur n'aurait jamais pu être payé |
| Aucun endpoint ne listait les comptes à vérifier | Le geste existait, la file non — donc il n'était jamais fait |
| Jetons de couleur du web restés sur l'ancien bleu | Le fichier se disait le reflet de `@motoboy/shared` et ne l'était plus |
| Cache de routes périmé | `OpenApiCoverageTest` déclarait deux endpoints introuvables alors qu'ils étaient écrits. Même famille que le `bootstrap/cache/config.php` de l'étape 2 |

### Reste ouvert

- **Aucun test sur les écrans web.** Le mobile a 89 tests, le web zéro : il n'y a pas encore de harnais de test côté web, et l'ajouter est un chantier à part entière.
- ~~La passe de reversement n'a jamais produit de reversement réel~~ — **exercée de bout en bout le 18 août 2026** : demande → offre → acceptation → paiement confirmé par le webhook → course roulée → grand livre → compte déclaré et vérifié → `PYT-…` à 7 200 F sur 8 000 F encaissés → validation → envoi → grand livre soldé. Voir ci-dessous.
- **Le support ne peut pas agir**, par choix : ni annuler ni rembourser depuis l'écran de suivi. Si le besoin se confirme, il passera par les Actions existantes et leurs gardes, jamais par une écriture directe.

---

## 8. La passe de reversement, exercée de bout en bout

Course à 8 000 F, commission 10 %, net 7 200 F. Le solde du grand livre est
passé de 12 600 F à 5 400 F — exactement la course encore non éligible, dont la
fin de course n'a pas 24 h. L'arithmétique se referme.

### Deux défauts que seul ce parcours pouvait révéler

| Défaut | Portée |
| --- | --- |
| `SendPayout` n'écrivait que `agency_id` au grand livre | Nulle pour un chauffeur, et `payee_id` est obligatoire depuis l'étape 1. Un reversement de chauffeur pouvait être **construit et validé, puis échouait au décaissement** — au moment précis où l'argent devait partir. Verrouillé par `test_a_driver_payout_can_actually_be_sent`, vérifié en remettant le bogue |
| `independent_drivers.moderate` absente de la base | La permission est bien déclarée dans `RoleAndPermissionSeeder`, mais le seeder n'avait pas été rejoué. **Toute la file de modération était fermée, administrateurs compris** — ce qui n'apparaissait pas parce que `motoboy:approve-driver` contourne l'API |

Le pont transitoire d'`AgencyLedgerEntry` a joué son rôle : plutôt que d'écrire
une écriture sans destinataire, la base a refusé bruyamment. C'est ce que son
commentaire annonçait.

### Reste ouvert

- ~~Sept actions écrivent encore au grand livre sans passer de bénéficiaire~~ —
  **contraction faite** : les neuf écritures passent désormais leur bénéficiaire,
  et le pont `booted()` d'`AgencyLedgerEntry` a été retiré. Deux de ces chemins
  — un ajustement manuel et la contre-passation d'un reversement en échec —
  n'étaient parcourus par aucun test ; ils le sont maintenant, et le test échoue
  si on retire le bénéficiaire, vérifié en le retirant.
- ~~La file des reversements ne nomme pas son bénéficiaire~~ — **corrigé** :
  `Payout` porte `payee` (genre, nom, téléphone) et `destination` (opérateur, nom
  du compte, numéro tronqué, vérifié ou non). L'écran met le nom en tête, la
  destination juste dessous, et l'envoi demande confirmation en répétant les deux.
  `agency_id` était aussi déclaré obligatoire au contrat alors qu'il est nul pour
  un chauffeur.
- ~~Le déploiement doit rejouer `RoleAndPermissionSeeder`~~ — **fait** :
  l'entrypoint du conteneur enchaîne `CountrySeeder`, `CitySeeder` et
  `RoleAndPermissionSeeder` après les migrations, appelés **nommément** et jamais
  par `db:seed`, dont le garde contre les données de démonstration repose sur un
  test d'`APP_ENV`. Coupable par `RUN_SEEDERS=false` si besoin.
