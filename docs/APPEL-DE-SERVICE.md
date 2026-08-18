# Appel de service — fonctionnalités et écrans

*Document de travail. Les décisions de fond sont en [Partie IV du
brief](BRIEF.md) ; l'ordre de construction est en [§9 de la
roadmap](ROADMAP.md). Ici : ce qu'on peut faire, et sur quels écrans.*

## En un coup d'œil

Un passager déclare où il est et où il va. Des chauffeurs indépendants proposent
un prix. Il choisit, paie, et reçoit les coordonnées du chauffeur.

**Ce que ce n'est pas** : du VTC. Pas de carte, pas de véhicule « à trois
minutes », pas de suivi de course. Le délai se compte en dizaines de minutes.

## Où ça vit

| Surface | Contenu |
|---|---|
| **Mobile — passager** | Demander, comparer les offres, payer, suivre |
| **Mobile — chauffeur** | Voir les demandes, offrir, conduire, être payé |
| **Web — administration** | Valider les dossiers chauffeur, suivre les incidents |

Une seule application mobile, **deux jeux d'onglets selon le rôle**. Un chauffeur
reste un passager quand il voyage : il ne change pas de compte, l'application
change de visage.

Le web est indispensable, pas optionnel : un dossier chauffeur, ce sont des
documents à lire côte à côte. Ça ne se fait pas au pouce.

---

## Fonctionnalités — passager

| # | Fonctionnalité | Notes |
|---|---|---|
| P1 | Créer une demande | Ville + point de repère au départ et à l'arrivée, nombre de personnes, quand |
| P2 | Suivre l'attente | La demande expire si personne ne répond ; l'écran le dit |
| P3 | Comparer les offres | Prix, véhicule, délai annoncé. **C'est le cœur du produit** |
| P4 | Accepter une offre | Un seul gagnant : la base arbitre, pas l'application |
| P5 | Payer | Réutilise le paiement Mobile Money existant |
| P6 | Obtenir les coordonnées | Nom, téléphone, plaque, modèle — après paiement |
| P7 | Annuler | Avant et après acceptation, avec des conséquences différentes |
| P8 | Retrouver ses courses | Dans « Mes voyages », à côté des réservations |

## Fonctionnalités — chauffeur

| # | Fonctionnalité | Notes |
|---|---|---|
| C1 | Devenir chauffeur | Depuis son compte passager : même identité, rôle en plus |
| C2 | Déposer son dossier | Permis, carte grise, pièce d'identité, assurance, véhicule |
| C3 | Suivre la validation | En attente, refusé **avec motif**, validé |
| C4 | Voir les demandes ouvertes | Celles de sa ville. Rafraîchissement manuel en v1 |
| C5 | Faire une offre | Un prix ferme et un délai annoncé, valables un temps |
| C6 | Suivre ses offres | En attente, acceptée, expirée, perdue |
| C7 | Conduire | Démarrer, terminer |
| C8 | Voir ses revenus | Solde, historique, reversements |
| C9 | Régler son compte de reversement | Opérateur et numéro Mobile Money |

## Fonctionnalités — administration (web)

| # | Fonctionnalité | Notes |
|---|---|---|
| A1 | File des dossiers | Ce qui attend une décision, le plus ancien d'abord |
| A2 | Instruire un dossier | Documents côte à côte, validation ou refus motivé |
| A3 | Suspendre un chauffeur | Sans supprimer son historique ni ses reversements dus |
| A4 | Consulter demandes et courses | Pour le support : « où en est ma course ? » |

---

## Les écrans — passager

| Écran | Rôle | États à prévoir |
|---|---|---|
| **Entrée** | Un bouton sur l'accueil : « Besoin d'un véhicule ? » | — |
| **Nouvelle demande** | Départ, arrivée, quand, combien | Champs incomplets, mêmes villes |
| **Demande envoyée** | Attente, avec le temps restant | Aucune offre encore, expirée, annulée |
| **Offres reçues** | La liste comparable — prix, véhicule, délai | Une offre, plusieurs, plus aucune valable |
| **Détail d'une offre** | Chauffeur, véhicule, plaque, prix | Offre expirée pendant la lecture |
| **Paiement** | Écran existant, réutilisé | En attente, échec, réussite |
| **Course confirmée** | Coordonnées, plaque, point de rendez-vous | En attente du chauffeur, en cours, terminée |
| **Annulation** | Ce qu'elle coûte, avant de valider | Avant acceptation (gratuite), après (à trancher) |

## Les écrans — chauffeur

| Écran | Rôle | États à prévoir |
|---|---|---|
| **Devenir chauffeur** | Ce que ça demande, avant de commencer | — |
| **Dossier** | Dépôt des pièces et du véhicule | Incomplet, envoyé, refusé avec motif |
| **Statut du dossier** | Où en est la demande | En attente, refusé, validé, suspendu |
| **Demandes ouvertes** | La liste de sa ville | Vide, chargement, hors zone |
| **Détail d'une demande** | Trajet, personnes, note du passager | Déjà pourvue pendant la lecture |
| **Faire une offre** | Prix et délai | Offre déjà faite, demande expirée |
| **Mes offres** | Ce qu'il attend | En attente, acceptée, perdue, expirée |
| **Course en cours** | Coordonnées du passager, démarrer, terminer | Aucune course, une seule à la fois |
| **Mes revenus** | Solde, historique, reversements | Sans compte de reversement configuré |
| **Compte de reversement** | Opérateur et numéro | Non renseigné, en cours de vérification |

## Les écrans — administration (web)

| Écran | Rôle |
|---|---|
| **File des dossiers** | Ce qui attend, le plus ancien d'abord |
| **Dossier chauffeur** | Documents, décision, motif de refus |
| **Chauffeurs** | Liste, recherche, suspension |
| **Demandes et courses** | Consultation pour le support |

---

## Le parcours, bout en bout

```
Passager                        Plateforme                    Chauffeur
   │                                 │                             │
   ├─ crée une demande ─────────────▶│                             │
   │                                 ├─ visible dans sa ville ────▶│
   │                                 │◀───────── fait une offre ───┤
   │◀── offres reçues ───────────────┤                             │
   ├─ accepte une offre ────────────▶│                             │
   │                                 ├─ les autres offres tombent  │
   ├─ paie ─────────────────────────▶│                             │
   │◀── coordonnées du chauffeur ────┤─── coordonnées du passager ▶│
   │                                 │◀──── démarre puis termine ──┤
   │                                 ├─ reverse au chauffeur ─────▶│
```

## États d'une demande

```
OUVERTE ──▶ OFFRES REÇUES ──▶ APPARIÉE ──▶ PAYÉE ──▶ EN COURS ──▶ TERMINÉE
   │              │               │
   ▼              ▼               ▼
EXPIRÉE    SANS CHAUFFEUR      ANNULÉE
```

Deux garde-fous portés par la base, pas par l'application : **un chauffeur n'a
qu'une course active**, et **une demande n'accepte qu'une offre**.

---

## Ce qui reste à trancher

Ces points changent des écrans, pas seulement du code. Ils appellent une décision
avant que je dessine.

**Quand encaisse-t-on ?** Tout à l'acceptation expose le passager — il paie un
chauffeur qui n'est pas encore là. Tout à la fin expose la plateforme — le
passager peut disparaître. Un acompte à l'acceptation et le solde à la fin
protège les deux, au prix d'un second encaissement.

**Que coûte une annulation après acceptation ?** Le chauffeur a peut-être déjà
roulé. Rien ne le dédommage aujourd'hui.

**Et si le chauffeur ne vient pas ?** Il faut un remboursement, et une trace qui
compte contre lui.

**Combien d'offres avant de choisir ?** Attendre trois offres donne un meilleur
prix mais fait patienter. Montrer la première tout de suite fait choisir trop
vite.

**Quelle portée pour « sa ville » ?** Un chauffeur de Bafang voit-il une demande
de Bafoussam ? Sans coordonnées, la proximité ne se calcule pas — il faudra une
règle explicite, par exemple les villes voisines déclarées.
