# Recette du web

Ce qu'il faut cliquer, dans quel ordre, et ce qui doit se produire.

**L'ordre n'est pas une commodité.** Les données s'enchaînent : pas d'agence sans
admission, pas de départ sans gare ni véhicule, pas d'embarquement sans billet
payé. Sauter une étape rend la suivante intestable.

Durée : environ une heure pour tout, dont la moitié sur l'espace agence.

---

## Avant de commencer

| Ce qu'il vous faut | Pourquoi |
|---|---|
| Votre compte administrateur | Admettre l'agence, régler la plateforme |
| **Un second numéro de téléphone** | Le responsable d'agence est un compte distinct, et il reçoit son code par SMS |
| Un téléphone avec l'application | Réserver et payer : le web ne vend pas |

Les adresses : le web sur `motoboy.sekuu.com`, l'API sur
`apimotoboy.sekuu.com/api`.

---

## Étape 0 — Le déploiement lui-même

Quatre défauts qui ne se voient pas en naviguant normalement. Cinq minutes.

**0.1 — Rechargez une page profonde.** Allez sur `/sign-in`, connectez-vous,
ouvrez n'importe quel écran, puis **F5**.

> Attendu : la page revient. Un 404 de Vercel signifie que `vercel.json` n'est pas
> déployé — la navigation interne fonctionnerait pourtant très bien, ce qui rend
> ce défaut invisible tant qu'on ne recharge pas.

**0.2 — Une adresse d'API sur le domaine web.** Ouvrez
`motoboy.sekuu.com/api/v1/ping`.

> Attendu : **404**. Si vous obtenez la page d'accueil, la réécriture avale les
> requêtes égarées — et un webhook de paiement mal adressé recevrait « livré »
> alors que rien n'a été traité.

**0.3 — La marque.** Regardez l'onglet du navigateur.

> Attendu : le « M » de MOTOBOY. Un éclair violet serait le logo de Vite.

**0.4 — La langue survit.** Basculez en anglais sur l'accueil public, puis **F5**.

> Attendu : la page revient en anglais.

---

## Étape 1 — Amorcer une agence

⚠️ **Il n'existe aucun écran pour candidater.** `POST /v1/agencies/register` est
public et fonctionne, mais aucun client ne l'appelle — ni le web, ni le mobile.
C'est une lacune connue, pas une panne. En attendant, la commande :

```bash
curl -X POST https://apimotoboy.sekuu.com/api/v1/agencies/register -H "Content-Type: application/json" -d '{"name":"Général Express","legal_name":"Général Express SARL","phone":"+237690000010","email":"contact@exemple.cm","manager_first_name":"Awa","manager_last_name":"Nkeng","manager_phone":"+237VOTRE_SECOND_NUMERO","locale":"fr"}'
```

Remplacez `manager_phone` par votre second numéro : **c'est lui qui recevra le
code** de connexion à l'espace agence.

> Attendu : une réponse `202` et un SMS. L'agence existe désormais, en attente.

---

## Où se connecter

**Le lien « Espace professionnel »** est en haut à droite de l'accueil public,
à côté du choix de la langue. Il mène à `/sign-in`.

**Un seul formulaire pour quatre espaces.** Administration, agence, embarquement,
propriétaire : c'est le rôle du compte qui décide où vous atterrissez, pas l'URL
tapée. Un compte agence est donc déposé sur ses Départs, un agent d'embarquement
sur le quai.

Si un compte porte deux rôles — gérer une agence *et* embarquer —, c'est le plus
large qui l'emporte : l'envoyer vers le plus restreint lui cacherait la moitié de
son travail.

---

## Étape 2 — L'administration

Connectez-vous avec votre compte administrateur.

**2.1 — Agences → « À instruire ».** L'agence créée doit y figurer.

> À regarder : la ligne dit **« Aucun compte de reversement vérifié »**. Elle est
> admissible, mais impayable — c'est ce que cette mention existe pour dire avant
> l'admission, pas après.

**2.2 — Ouvrez le dossier, puis « Refuser ».** Le bouton de confirmation doit
rester **inerte** tant qu'aucun motif n'est écrit. Revenez sans confirmer.

**2.3 — Conditions commerciales.** Dans le même panneau. Trois pièges à éprouver :

- Passez la commission de « Pourcentage » à « Montant fixe » : le libellé et
  l'indice doivent changer de sens — **500 se lit « 5 % » ou « 500 F »**.
- Passez la fréquence de reversement à « Mensuelle » : la liste des jours de la
  semaine doit devenir un **quantième**. C'est le piège central — l'API accepte
  1 à 28 dans les deux cas, et « 15 » en hebdomadaire serait silencieusement
  ramené à dimanche.
- Modifiez **un seul champ** : le compteur doit annoncer « 1 champ modifié ».
  Seul celui-là part.

**2.4 — Admettez l'agence.** Elle passe dans « Admises ».

**2.5 — Journal d'audit.** Votre admission et votre changement de conditions y
figurent, avec **l'avant et l'après** — « 250 → 900 », pas « conditions
modifiées ».

**2.6 — Réglages.** Saisissez `4,5` comme commission de course.

> Attendu : « Enregistré comme 450 points de base ». Saisissez `45` : le bouton
> doit se bloquer. Une erreur d'un facteur cent y est invisible à l'écran et bien
> visible sur une facture.

**2.7 — Référentiel.** Le bouton « Approuver » d'une demande de ville doit rester
inerte tant qu'aucun identifiant n'est saisi. Et une gare se **désactive**, jamais
ne se supprime.

**2.8 — Tableau de bord.** Les compteurs qui attendent une décision sont en
orange, **et seulement s'ils ne sont pas à zéro**.

---

## Étape 3 — L'espace agence

Déconnectez-vous. Reconnectez-vous avec **le numéro du responsable** et le code
reçu à l'étape 1 — le même formulaire, qui vous déposera cette fois sur les
Départs de l'agence.

L'ordre est imposé par les données :

**3.1 — Pièces.** Déposez un PDF. Essayez d'abord un fichier de plus de 8 Mo : le
bouton doit se bloquer **avant l'envoi**. La liste nomme ensuite les pièces
**manquantes**, pas seulement les déposées.

**3.2 — Gares.** Créez-en deux, dans deux villes différentes. Le champ « Ville »
n'accepte que des suggestions du référentiel — tapez sans choisir, rien ne doit
partir.

**3.3 — Véhicules.** Créez-en un. **Lisez l'explication du mode de placement
avant de choisir** : « siège choisi » ne se change plus une fois des départs
vendus.

**3.4 — Chauffeurs.** Créez-en un sans véhicule habituel — c'est facultatif et
doit passer.

**3.5 — Itinéraires.** Reliez vos deux gares. Puis « Ajouter un horaire » : les
sept jours sont cochés d'emblée, décochez-en un. Le bouton reste bloqué tant
qu'aucun **véhicule** n'est désigné.

**3.6 — Générer les départs.** Depuis la page Itinéraires.

> Attendu : un nombre de départs créés. Sans cette étape, les Départs, le Guichet
> et l'Embarquement resteront vides — et ce n'est pas un bug.

**3.7 — Départs.** Vos départs générés apparaissent.

**3.8 — Compte.** Déclarez un compte de versement. Le numéro et le titulaire
doivent partir **sans espaces de bord**. Choisissez « Compte bancaire » : le
sélecteur d'opérateur doit **disparaître**, pas être ignoré.

**3.9 — Personnel.** Ajoutez un guichetier. Le profil choisi décide du droit
d'encaisser, et l'écran doit l'expliquer sous le choix.

---

## Étape 4 — Vendre, payer, embarquer

**4.1 — Le comparateur public.** Sur `motoboy.sekuu.com`, cherchez votre trajet à
la date d'un départ généré. Il doit apparaître, avec les places **restantes**.

**4.2 — Réservez depuis l'application mobile**, jusqu'au paiement.

**4.3 — Payez avec `+237670000000`.**

> ⚠️ NotchPay en bac à sable **n'accepte que cinq numéros**. Les autres sont
> refusés avant tout prélèvement. Voir [DEPLOIEMENT.md](DEPLOIEMENT.md) § 6 quater.
>
> Éprouvez aussi `+237670000003` — délai dépassé : c'est celui qui met à
> l'épreuve la reprise et le remboursement.

**4.4 — Embarquement, côté bureau.** Onglet Embarquement, choisissez le départ.
Votre passager doit figurer en « Attendu ». Saisissez sa référence de billet à la
main : il passe à « Embarqué ».

**4.5 — Guichet.** Vendez une place à quelqu'un devant vous. Puis annulez une
réservation par sa référence : la confirmation doit **nommer la référence et le
remboursement**.

---

## Étape 5 — Le bilingue

**5.1 — Public.** Basculez en anglais : titre, champs, résultats, tout suit.

**5.2 — Espace agence.** Le sélecteur est dans le bandeau. La navigation entière
doit se renommer.

**5.3 — Embarquement.** Le sélecteur est dans l'en-tête de la PWA.

**5.4 — Administration.** Elle **reste en français**, et c'est une décision du
brief : outil interne.

**5.5 — Une erreur en anglais.** Ouvrez une référence de départ inexistante.

> Attendu : le message d'erreur suit la langue choisie. C'était un défaut réel
> jusqu'à hier — la langue était lue une fois au chargement, depuis le navigateur.

---

## Ce qui n'est pas un bug

Avant de signaler quelque chose, vérifiez qu'il ne figure pas ici.

| Constat | Pourquoi |
|---|---|
| **Aucune candidature d'agence en ligne** | `agencies/register` n'a pas d'écran. Lacune connue, corrigeable |
| **Les reversements « réussissent » toujours** | `PAYOUT_GATEWAY=fake` : le pilote **simule** un succès. Rien ne part. **Ne testez pas un décaissement comme s'il était réel** |
| L'administration est en français seul | Décision du brief : usage interne |
| Pas de « rechercher un billet » à l'embarquement | La saisie manuelle valide déjà. Deux formulaires jumeaux dont l'un embarque et l'autre non invitent à se tromper |
| `TCK-XXXXXX`, `LT-4412-AB` restent tels quels | Ce sont des gabarits. Un format ne change pas de langue |
| Le tableau de bord ne compte pas les chauffeurs | L'API ne renvoie pas ce nombre. C'est aussi pourquoi la file des chauffeurs reste la page d'accueil |
| Le paiement en bac à sable n'envoie rien sur votre téléphone | Il n'y a pas de code à saisir en test. Le dénouement arrive par webhook, en une seconde |

---

## Si quelque chose échoue

Notez **ce que vous attendiez** et **ce que vous avez vu**, avec l'URL. Pour une
erreur affichée, la copie d'écran suffit ; pour un 500, il faut la ligne du
journal Render.

Et si le web semble ne pas se mettre à jour : le service worker de l'embarquement
peut retenir une version. Rechargez avec **Ctrl+Maj+R**.
