# Feuille de route — interfaces

> Les écrans. L'API est complète et déployée ; ce document couvre ce qui la
> consomme.
>
> **Dernière mise à jour** — 14 août 2026

Le reste du projet est dans [ROADMAP.md](ROADMAP.md). Les décisions produit sont
dans [BRIEF.md](BRIEF.md), et le contrat dans [openapi.yaml](openapi.yaml) —
lisible sur `/docs` de l'instance déployée.

---

## 1. Ce qui existe

| Élément | État |
|---|---|
| `@motoboy/api-client` | client typé **généré** depuis le contrat, plus une entrée sans DOM |
| `@motoboy/shared` | locale, montants, dates, libellés d'erreur, jetons de design |
| `apps/mobile` | **parcours passager complet** · 72 tests |
| `apps/web` | Vite nu — un écran de vérification |

**Ce qui n'existe pas** : tout le web, et la PWA d'embarquement.

Le parcours passager de [§35](BRIEF.md) est complet de bout en bout : chercher,
comparer, choisir sa place, réserver, payer, embarquer avec son billet hors
ligne, annuler.

**Le harnais de test est en place** — jest-expo et Testing Library, fuseau et
langue épinglés, branché dans `pnpm verify`. 38 tests.

---

## 2. Trois règles qui ne se négocient pas

**Le backend décide.** Disponibilité, prix final, statut d'une réservation,
validité d'un billet : le client affiche, il ne recalcule pas ([§29](BRIEF.md)).
Le jour où `@motoboy/shared` recalcule des frais d'annulation, la règle existe en
deux exemplaires et elles divergeront — c'est déjà écrit en tête du package, et
ça reste vrai des écrans.

**Le client branche sur `code`, jamais sur `message`.** Le message d'erreur de
l'API est un diagnostic destiné aux journaux ; le texte affiché se compose
côté client à partir du code typé, dans la langue de l'utilisateur
([I10](BRIEF.md)). Les libellés sont déjà dans `shared/labels.ts`.

**Deux langues dès le lancement.** Le Cameroun est bilingue : `fr` et `en` en
même temps, pas l'un puis l'autre. Une interface conçue en une seule langue se
réécrit pour en accueillir une seconde.

---

## 3. Socle partagé

*Rien ne peut être écrit avant.*

### 3.1 Catalogues de traduction — ✅ fait

`fr` et `en`, **tous dans `@motoboy/shared`** : un traducteur ne doit pas les
chercher à deux endroits, et le ton du produit se tient d'un seul.

Un catalogue **par espace produit** — commun, passager, puis agence et
administration — et non un par application : c'est le découpage qui a un sens
pour qui traduit, et il survit au jour où le parcours passager existera aussi
sur le web.

Chacun s'importe par **point d'entrée dédié** — `@motoboy/shared/i18n/passenger`
— et n'est pas réexporté par l'index du package : Metro ne secoue pas l'arbre, et
passer par l'index ferait embarquer au mobile les textes du back-office. Chaque
application branche ensuite son propre moteur.

### 3.2 Session et jeton — ✅ fait

Le jeton Sanctum se stocke différemment selon la plateforme — coffre du système
sur mobile, mémoire plus stockage sur web. D'où un **port** dans `shared`, et une
implémentation par application : le client d'API ne doit connaître ni l'un ni
l'autre.

### 3.3 Client d'API prêt à l'emploi — ✅ fait

Le client généré ne sait rien de l'authentification ni des erreurs. Il lui
manque : l'en-tête `Authorization`, la traduction d'une réponse d'erreur en
objet typé, et la clé d'idempotence sur les opérations qui en exigent une.

### 3.4 Primitives d'interface — ✅ amorcé

**Les composants ne se partagent pas, seuls les jetons.** shadcn repose sur Radix
et le DOM ; le mobile a ses propres primitives. C'est déjà écrit dans
`tokens.ts`, et c'est ce qui évite d'inventer une couche d'abstraction qui
servirait deux fois mal.

---

## 4. Mobile — le parcours passager

*Dans l'ordre du voyage, parce que chaque écran se nourrit du précédent.*

### 4.0 Onboarding — ✅ fait

Trois écrans, pas davantage : ce qu'il y a à dire tient en trois phrases —
comparer, réserver, embarquer. Un onboarding plus long se saute entièrement.

**« Passer » est visible dès le premier écran.** Un passager qui veut son billet
ne doit pas traverser une introduction, et cacher la sortie ne la fait pas lire,
elle fait désinstaller.

Le marqueur « déjà vu » vit dans le stockage de l'application, pas dans le
compte : l'onboarding s'affiche **avant toute inscription** — c'est son objet.
Le lier au compte le ferait réapparaître à chaque changement de téléphone.

L'aiguillage d'entrée n'affiche **ni** l'onboarding **ni** la recherche tant
qu'il ne sait pas : montrer l'un puis basculer sur l'autre produirait un
clignotement à chaque démarrage.

### 4.1 Navigation et coquille — ✅ fait

Expo Router, avec le schéma `motoboy://` : les liens profonds comptent — un SMS
de confirmation doit pouvoir ouvrir le billet. Les onglets — rechercher, mes
billets, compte — arrivent avec les écrans qu'ils desservent.

Le cache des requêtes est **persisté sur le disque**, et c'est ce qui rendra le
billet consultable sans réseau. Seules les données sans caractère secret y
entrent : le cache est écrit en clair, et y laisser le profil d'un compte
déconnecté le rendrait lisible après coup.

**Un accroc trouvé en construisant le bundle** : aucun package du workspace ne
traversait Metro. Les imports relatifs y portent l'extension `.js` — la
convention que `moduleResolution: nodenext` impose pour désigner un `.ts` — et
Metro cherchait un vrai fichier `.js`. La compilation TypeScript passait ; le
bundle, lui, échouait. L'écran dit « de vérification de la chaîne » ne vérifiait
donc rien. Corrigé dans `metro.config.js`, et vérifié par un export réel.

### 4.1 bis Architecture — ✅ posée

Découpage **par fonctionnalité**, décrit dans
[apps/mobile/ARCHITECTURE.md](../apps/mobile/ARCHITECTURE.md). Les routes
n'implémentent rien : un fichier de `app/` réexporte l'écran de sa
fonctionnalité, pour qu'un changement de routeur n'oblige pas à réécrire les
écrans — et qu'un écran se monte dans un test sans routeur du tout.

Les **clés de cache** sont produites par une fabrique typée plutôt qu'écrites à
la main dans les écrans. Une clé recopiée est une clé qu'on invalide mal : le
singulier ici, un identifiant oublié là, et la liste des billets cesse
silencieusement de se rafraîchir après une réservation. Le bogue n'apparaît pas
à la compilation, il apparaît quand un passager ne voit pas son billet.

### 4.2 Recherche — ✅ fait

Deux villes et une date, et rien d'autre. Les filtres — prix, horaire, agence —
vivent sur les résultats : les demander avant d'avoir montré une offre ferait
renoncer quelqu'un qui veut simplement savoir s'il y a un car ce soir.

L'autocomplétion tape le référentiel fermé — c'est ce qui fait que « Douala »,
« douala » et « Dla » retournent la même chose. Elle propose villes **et**
gares, mais une gare **résout vers sa ville** : sans cela, deux agences
desservant Douala depuis deux gares différentes ne seraient jamais comparées, ce
qui est précisément l'objet du produit.

Le sélecteur de ville est en plein écran, pas en liste déroulante : le clavier
occupe la moitié d'un téléphone, et une liste coincée dans ce qui reste
n'afficherait que deux résultats.

La date du jour est calculée dans le **fuseau d'affichage**, pas celui de
l'appareil : construire la date depuis l'horloge du téléphone ferait chercher la
veille pour quelqu'un qui ouvre l'application à une heure du matin.

### 4.3 Résultats — ✅ fait

Prix, horaire, agence, places restantes, **et les conditions d'annulation** :
elles varient d'une agence à l'autre et deviennent un critère de comparaison
affiché, pas une ligne de conditions générales ([B5](BRIEF.md)). Les frais nuls
se disent « annulation gratuite » — c'est un argument commercial.

Les critères passent par l'URL et non par un état partagé : un résultat doit
être partageable et rouvrable par un lien profond, et un état en mémoire
disparaîtrait au premier retour arrière.

**Jamais de page vide.** Quand rien ne sort, l'écran affiche les dates proches
disponibles et les axes desservis depuis la même ville — que le serveur renvoie
déjà dans le même appel. La couverture sera faible au lancement, ce cas sera
fréquent, et un passager déçu deux fois ne revient pas.

Les erreurs se distinguent : « pas de réseau » et « le serveur a refusé »
appellent deux réactions opposées, et le texte affiché vient du **code** de
l'erreur, jamais de son message.

### 4.4 Détail du départ et plan de sièges — ✅ fait

Le plan distingue libre, choisie, tenue et vendue. Une place **tenue** par un
paiement en cours est indisponible **au même titre** qu'une place vendue : la
laisser cliquable ferait échouer la réservation au dernier écran, après la
saisie des noms. Les deux se distinguent néanmoins à l'affichage — l'une peut
se libérer, ce qui explique au passager pourquoi le plan a changé quand il y
revient. L'échéance, elle, ne lui est pas montrée : elle ne lui sert à rien et
exposerait le rythme des ventes d'une agence.

**L'état est dit, pas seulement coloré.** Chaque place annonce son numéro et son
état au lecteur d'écran : une place prise et une place libre ne doivent pas se
distinguer par la seule couleur.

En mode `CAPACITY`, **aucun plan n'est affiché** — la protection repose sur un
compteur, et inventer des sièges reviendrait à en montrer qui n'existent pas
dans le car.

Le plan vieillit vite : il se rafraîchit au tirer, et sa fraîcheur est bornée à
trente secondes. Mais **l'écran affiche, il ne décide pas** — c'est l'index
unique partiel qui arbitre au moment de réserver, et deux passagers peuvent
viser le même siège à la seconde près.

### 4.5 Réservation — ✅ fait

Un formulaire par passager, plus **un contact** : c'est lui qui reçoit le billet
et les alertes de départ, pas le premier voyageur. Une réservation se fait
couramment pour quelqu'un d'autre, et envoyer le billet au passager plutôt qu'à
l'acheteur le laisserait sans rien.

La réservation **tient les places à l'envoi**, avant tout paiement. Le compte à
rebours est donc visible en permanence, pas caché derrière un avertissement
qu'on ferme : un passager qui cherche son téléphone pour saisir son code Mobile
Money doit voir ce qu'il lui reste, sinon la perte de sa place ressemble à une
panne ([B2](BRIEF.md)).

**La clé d'idempotence survit aux tentatives.** C'est tout son objet : en
régénérer une à chaque essai reviendrait à ne pas en avoir, et une requête qui
expire côté téléphone mais aboutit côté serveur — banal sur une connexion de
gare — ferait tenir deux fois les places et payer deux fois.

Un conflit d'inventaire **se dit et se répare** : « une place vient d'être
prise » appelle un geste précis, choisir une autre place, que l'écran propose.
Un message générique laisserait le passager réessayer indéfiniment le même
siège. « Complet » et « ventes closes », eux, n'offrent pas ce geste — parce
qu'il n'existe pas.

### 4.6 Paiement — ✅ fait

Mobile Money, **asynchrone par nature** : le passager reçoit une sollicitation
sur son téléphone et saisit son code. L'écran ne promet donc **aucun succès** et
n'abandonne pas au premier délai — il attend, en le disant, et interroge le
serveur toutes les deux secondes jusqu'au verdict. L'interrogation s'arrête
d'elle-même une fois le sort connu : la poursuivre viderait la batterie pour
redemander une réponse qui ne changera plus.

**`PENDING` et `PROCESSING` se disent pareil** au passager : la différence est
interne au prestataire et ne lui offre aucun geste différent.

⚠️ **La clé d'idempotence se renouvelle ici, contrairement à la réservation.**
Une réservation rejouée doit rendre la même réservation ; une tentative de
paiement est *une autre tentative* — le contrat prévoit explicitement plusieurs
paiements par réservation, dont un seul aboutit. Réutiliser la clé renverrait
l'échec précédent, et le passager qui recompose correctement son code verrait le
même refus.

L'échec est banal et réessayer est le cas nominal : l'écran le dit, et rappelle
que **les places restent tenues**. La tenue expirée, en revanche, coupe court —
proposer de payer promettrait un siège qui n'existe plus.

### 4.7 Billet et QR Code — ✅ fait

**Consultable sans réseau.** Le billet est en cache sur le disque, et le QR se
**dessine sur l'appareil** à partir de `qr_payload` — jamais téléchargé comme
image. Un billet dont le code dépend du réseau ne s'affiche pas au moment précis
où il n'y en a pas : en gare, devant l'agent ([I5](BRIEF.md)).

Le détail est en `offlineFirst` : le billet en cache s'affiche immédiatement,
sans attendre une réponse qui ne viendra peut-être pas. Un billet ne changeant
qu'à l'annulation ou à l'embarquement, sa fraîcheur est bornée à une heure —
le rafraîchir sans cesse coûterait du réseau là où il y en a le moins.

**Un test protège la contrainte hors ligne** : il vérifie qu'aucune source
distante n'entre dans l'arbre rendu. Le jour où quelqu'un remplacerait le rendu
local par une image téléchargée, le billet cesserait de s'afficher en gare — et
rien d'autre ne le signalerait.

Après paiement, on arrive sur la **liste** et non sur un billet : une
réservation de trois places produit trois billets, un par passager, et la
référence de réservation n'en désigne aucun.

### 4.8 Compte et historique — ✅ fait

Inscription et connexion **sur le même écran**, qui ne diffèrent que par deux
champs de nom : en faire deux obligerait le passager à décider, avant de
commencer, s'il a déjà un compte — question à laquelle il ne sait pas toujours
répondre.

**La connexion arrive au dernier moment.** Recherche, résultats et plan de
sièges fonctionnent sans compte ; c'est en appuyant sur « Continuer », au moment
de réserver, qu'elle est demandée — et l'écran dit pourquoi. La destination
voyage avec : renvoyer sur l'accueil après connexion obligerait à refaire toute
la recherche.

**Le renvoi de code attend trente secondes.** Chaque envoi coûte un SMS et l'OTP
est le seul canal sans alternative : un bouton toujours actif invite à insister,
et la facture suit ([I8](BRIEF.md)). Le délai laisse aussi au message le temps
d'arriver sur un réseau lent, avant que le passager ne conclue qu'il s'est perdu.

Les tentatives restantes sont affichées : découvrir le blocage au dernier essai
n'aide personne. La déconnexion **vide le cache** — y laisser les réservations
d'un compte les rendrait visibles au suivant, sur un téléphone qui change de
mains — et se ferme localement même hors ligne.

### 4.9 Annulation — ✅ fait

Le **devis d'abord**, et le bouton reste inactif tant qu'il n'a pas répondu :
valider sur un montant inconnu est exactement ce que cet écran existe pour
éviter. Sans lui, le passager découvre les frais retenus après coup, et une
règle qu'il avait acceptée devient un litige ([B5](BRIEF.md)).

**Annulation partielle comprise** — trois places réservées, une annulée. Le
choix des passagers n'apparaît qu'au-delà d'un seul : le proposer sinon
reviendrait à demander une décision qui n'existe pas. Le devis se recalcule à
chaque changement, et la clé de cache porte la sélection — partager un cache
entre « une place » et « tout le monde » annoncerait le mauvais montant.

L'écran dit **où repart l'argent** : vers le compte qui a payé, jamais vers un
numéro déclaré après coup. Et quand rien ne transite par la plateforme — vente
au comptoir encaissée en espèces — il le dit aussi, plutôt que de laisser
attendre un virement qui ne viendra pas.

La clé d'idempotence est **conservée** entre les tentatives, comme à la
réservation et contrairement au paiement : une annulation rejouée doit rendre la
même annulation, sans quoi la seconde porterait sur des passagers déjà annulés.

L'entrée est le billet : c'est là qu'un passager pense à annuler, et là qu'il a
sous les yeux ce qu'il s'apprête à perdre.

### 4.9 bis Design system — ✅ appliqué à tout le parcours

La référence est `stitch_motoboy_mobility_platform/` : quinze écrans rendus et un
`DESIGN.md`, versés au dépôt comme **normatifs**, au même titre que
`docs/openapi.yaml` l'est pour l'API.

**Quand le document et l'écran divergent, l'écran gagne.** `DESIGN.md` annonce un
bouton primaire or ; chaque maquette montre un CTA bleu, l'or restant aux
contours secondaires, aux repères d'origine et aux titres de section. C'est
l'écran qui a été validé.

Jetons (bleu `#0f0fa9`, or `#e9bc17`, page `#fbf8ff`, grille de 8), barre
d'onglets, mot-symbole sur chaque route, boutons en capsule, champs à rayon 8,
fil d'étapes places/infos/paiement, compte à rebours en bandeau d'alerte — puis
les treize écrans du parcours.

**Ce que la maquette demande et qui n'existe pas.** À chaque fois, l'absence est
préférée au leurre :

| Demandé | Choix |
|---|---|
| Badge VIP / CLASSIQUE | Gabarit du véhicule — un vrai critère de comparaison |
| Logo d'agence, photo de profil | Initiales |
| « Modifier », notifications, aide | Omis : aucun endpoint |
| Réglage de langue | Affiché, pas réglable — sans persistance il repartirait à zéro |
| Carte bancaire au paiement | Omis : pas de passerelle |
| Illustrations d'onboarding | Panneau teinté et glyphe |
| Code OTP à 4 cases | Six, comme le serveur les émet |

Le nombre de voyageurs, lui, a été gardé **en le rendant réel** : il traverse la
recherche jusqu'au plan de sièges, où il dira combien de places choisir.

### 4.10 Essayer le parcours en local — ✅ vérifié de bout en bout

**Expo Go doit correspondre au SDK.** Le projet est sur le SDK 57, qui réclame
Expo Go **57.0.3 ou plus** ; en dessous, l'application refuse de charger avec
« Project is incompatible with this version of Expo Go ». Le Play Store est
souvent en retard : la version exacte se lit sur
`https://api.expo.dev/v2/versions/latest`, et l'APK officiel correspondant est
publié sur le dépôt `expo/expo-go-releases`.

L'adresse de l'API n'a pas à être réglée : elle se déduit de l'hôte du serveur
Metro, la seule que le téléphone sait déjà joindre puisqu'il vient d'y charger le
paquet.

Deux points bloquent un essai manuel, par construction et non par oubli :

- **L'OTP n'est envoyé nulle part** tant qu'aucun fournisseur SMS n'est branché.
  Le pilote de journalisation l'écrit dans `storage/logs/laravel.log`.
- **Rien n'est encaissé de façon synchrone**, le vrai Mobile Money non plus. Le
  parcours s'arrête sur l'écran d'attente jusqu'à l'arrivée d'un webhook qui,
  sans agrégateur, n'arrive jamais. `php artisan motoboy:confirm-payment` le joue
  — en passant par le **vrai contrôleur**, donc en exerçant le journal des
  webhooks, l'idempotence et l'émission des billets. La commande refuse de
  s'exécuter en production et hors pilote factice : marquer un paiement comme
  encaissé est un distributeur de billets gratuits.

---

## 5. Web

*Après le mobile : le passager passe par le téléphone, l'agence par un écran.*

### 5.1 Espace agence

Inventaire — gares, véhicules et plan de sièges, chauffeurs, itinéraires,
horaires, génération des départs. Puis vente au guichet, embarquement,
réservations, compte courant et reversements, personnel.

**La vente au guichet est le seul écran dont la vitesse est une exigence
fonctionnelle** : plus lente que le cahier, elle ne sera pas utilisée, et toute
la fiabilité de la disponibilité affichée s'effondre avec elle
([I2](BRIEF.md)).

### 5.2 Espace administration

Validation des agences, vérification des coordonnées de reversement, conditions
commerciales, référentiel géographique, reversements, audit, tableau de bord.

### 5.3 Espace propriétaire

Consultation seule, aucun circuit financier ([I3](BRIEF.md)).

### 5.4 Pages publiques

Recherche et résultats. Identité propre, pas une apparence d'outil
d'administration.

---

## 6. PWA d'embarquement

Service worker, liste d'embarquement pré-téléchargée, file locale des
validations synchronisée au retour du réseau. L'API est en place, y compris la
distinction entre un **renvoi** et un **doublon** — sans elle, chaque coupure
réseau fabriquerait un faux doublon et la statistique censée révéler un vrai
problème d'exploitation deviendrait du bruit.

À traiter avec l'espace agence : c'est le même utilisateur, sur le même terrain.

---

## 7. Ce qui reste ouvert

| Sujet | Pourquoi ça n'est pas tranché |
|---|---|
| **Décaissement** | `PAYOUT_GATEWAY=fake` : le pilote factice **simule** un succès, donc l'écran des reversements annoncerait de l'argent parti alors que rien n'a bougé. C'est le dernier chemin d'argent non réel |
| **Suivi d'erreurs et supervision** | [I7](BRIEF.md) les dit non négociables sur un produit qui encaisse de l'argent |
| **Liste des villes** | Seedée, jamais validée sur le terrain. La recherche ne vaudra que ce qu'elle vaut |

---

## 8. Identité visuelle

Le logo est arrivé en JPEG : 669 × 631, bruit de compression dans le marine,
vignettage qui assombrit le bas, et **aucune transparence**. Il a été redessiné
en tracé — non pas réinterprété : les proportions ont été relevées au pixel sur
l'image d'origine, piste par piste. La marque est franchement asymétrique (bosse
gauche haute, bosse droite basse et courte, creux profond), et c'est ce qui la
rend reconnaissable ; un « M » symétrique dessiné de mémoire n'y ressemble pas.

La géométrie vit dans `packages/shared/src/brand.ts`, sans DOM ni React Native,
donc partagée telle quelle par le web, le mobile et le script d'icônes. Les onze
rasters que réclament Expo, le manifeste PWA et iOS sont **générés** :

```
pnpm brand
```

Aucun PNG ne se maintient à la main. Le script vérifie ensuite son propre rendu :
il compte les pixels du dessin tombant hors du carré arrondi et échoue s'il y en
a — un sommet remonté déborderait sans que rien ne le dise avant l'écran
d'accueil d'un téléphone.

**Deux couleurs, deux raisonnements.** Le marine est celui de l'interface
(`#10314f`) et non celui du fichier (`#031a60`, bleu roi) : un logo bleu roi posé
sur un en-tête `bg-ink-700` donne un rectangle légèrement violet au milieu du
marine, ce qui se lit comme un export raté plutôt que comme une marque. L'or
(`#fcb50d`) reste en revanche celui de la marque : l'orange `#f4661b` est réservé
à l'action et à elle seule, et habiller l'identité de la couleur de l'action lui
ferait porter un vêtement qui veut dire « touchez ici ».

Deux vestiges de gabarit ont été trouvés au passage et corrigés : le favicon du
web était **le logo violet de Vite** — donc l'embarquement installé sur l'écran
d'accueil d'un agent portait la marque de Vite — et `<title>web</title>` était
resté. Côté mobile, `backgroundColor: "#E6F4FE"` venait du gabarit Expo, et
`splash-icon.png` existait sans être référencé nulle part : l'écran de démarrage
n'était pas branché.

### Ce qui n'est pas fait

Il n'existe pas de **logotype** — le mot « MOTOBOY » reste composé en gras dans
la fonte de l'interface, à côté de la marque. Un vrai dessin du mot demanderait
un choix typographique qui n'a pas été fait, et l'inventer ici aurait produit une
identité que personne n'a validée.

---

## 9. Saisie au clavier

Les cinq écrans de saisie portaient chacun leur copie de
`behavior={Platform.OS === 'ios' ? 'padding' : undefined}`. Sur Android,
`behavior` absent ne signifie pas « comportement par défaut » : `KeyboardAvoidingView`
s'y réduit alors à une `View`, sans rien faire. Tout reposait donc sur
`adjustResize`.

Or l'affichage bord à bord, activé d'office depuis le SDK 54, neutralise
précisément ce redimensionnement — c'est écrit dans le README de
`react-native-edge-to-edge`, que le SDK embarque : « Enabling edge-to-edge display
disrupts Android keyboard management ». Le clavier se posait donc par-dessus les
champs **et** par-dessus le bouton d'envoi, obligeant à le refermer pour valider.

`KeyboardForm` remplace les cinq copies. `padding` sur les deux plateformes prend
la place de ce que le système ne fait plus ; iOS ne change pas, il l'utilisait
déjà. Le défilement vers le champ actif revient tout seul : le `ScrollView`
d'Android amène de lui-même l'élément qui prend le focus dans la partie visible,
mais il lui fallait une partie visible à calculer — tant qu'il gardait sa hauteur
pleine, il n'avait rien à faire défiler.

`react-native-keyboard-controller` ferait mieux et c'est la recommandation
d'Expo, mais c'est un module natif : il ne fonctionne pas dans Expo Go, où se
fait tout le test aujourd'hui. À reconsidérer le jour où il y aura une
construction de développement.

### Deuxième passe : la hauteur annoncée, pas déduite

`padding` a partiellement corrigé le tir — le clavier remontait, mais les derniers
champs restaient masqués et le défilement s'arrêtait avant la fin. « Partiellement »
était l'indice : le rembourrage s'appliquait, mais trop court.

`KeyboardAvoidingView` ne lit pas la hauteur du clavier, il la déduit en
retranchant le haut du clavier de sa propre position mesurée. Ces deux valeurs
viennent de repères différents — la vue est mesurée dans la fenêtre, le clavier
dans l'écran — et sous le bord à bord ces repères cessent de coïncider : ils
diffèrent de la hauteur de la barre de navigation. D'où un rembourrage trop court
d'autant, et une course de défilement amputée de la même quantité.

`Keyboard.addListener` annonce `endCoordinates.height`, qui ne se déduit de rien.
C'est cette valeur qui est désormais retirée au cadre.

Quatre tests la verrouillent, en interceptant les abonnements plutôt qu'en
nommant les événements : le composant s'abonne aux `Will` sur iOS et aux `Did`
sur Android, et un test qui les écrirait en dur passerait sur une plateforme en
mentant sur l'autre. Amputer le rembourrage de 48 unités fait échouer deux d'entre
eux — c'est ainsi qu'on sait qu'ils regardent la bonne chose.

---

## 10. L'encaissement mobile

Le paiement n'aboutissait pas, et la cause n'etait pas dans le parcours : le
numero du payeur n'arrivait jamais dans le champ que l'agregateur lit.

L'encaissement NotchPay se fait en deux appels. Le second — celui qui pousse la
sollicitation sur le telephone — envoyait `data.account_number`. Or l'exemple de
leur reference remplit `data.phone` (`237680000000`) et **laisse
`account_number` vide**. Le numero partait donc dans un champ ignore, et rien
n'etait jamais demande a personne.

Aucun format n'etait impose non plus, d'un bout a l'autre de la chaine : le
mobile envoyait la saisie telle quelle, l'API n'en verifiait que la longueur,
l'adaptateur la transmettait sans y toucher. « 690 00 00 01 », « +237690000001 »
et « 00237690000001 » designent le meme abonne et arrivaient sous trois formes,
dont deux refusees. C'est le meme accroc que sur les SMS, ou le `+` avait suffi
a ce que rien ne parte — et un refus sur un format de numero ne ressemble pas a
une erreur de format, il ressemble a un paiement qui n'aboutit pas.

Les deux formes coexistent chez eux, chacune a son endroit : `+237…` a la
creation, `237…` au prelevement. L'adaptateur normalise desormais lui-meme, et le
champ de saisie porte l'indicatif comme celui de la connexion.

**Le test existant verrouillait le bug.** Il affirmait `account_number ===
'+237690000001'` : il encodait l'hypothese fausse, donc il ne pouvait pas la
contredire. Pire, son `Http::assertSent` renvoyait `true` pour toute requete
autre que celle visee — et comme l'assertion passe des qu'*une* requete satisfait
le rappel, celle de creation la satisfaisait a elle seule. Le test ne regardait
rien. Resserre, il fait echouer six cas quand on remet le defaut, contre un seul
auparavant.

L'ecran de paiement n'avait par ailleurs **aucune** gestion du clavier — il ne
figurait pas dans le releve precedent, qui cherchait les `KeyboardAvoidingView`
existants et non les formulaires qui en manquaient. Il passe a `KeyboardForm`.

### Le 500 derriere le message de validation

Les journaux ont donne la reponse : `POST /bookings/…/payments` en **500** apres
2,6 s — la duree de deux appels a l'agregateur — puis un webhook NotchPay une
seconde plus tard. La transaction etait donc bien creee chez eux ; c'est notre
code qui echouait juste apres.

`payments.failure_reason` etait une colonne de **cent caracteres**, et trois
actions y ecrivaient brut le motif rendu par le prestataire. « Agregateur
injoignable : cURL error 28: Operation timed out after 20001 milliseconds… » la
depasse a lui seul. PostgreSQL refusait l'ecriture, et **un refus de paiement — le
cas le plus banal en Mobile Money — remontait en erreur serveur.**

Le depot le savait a moitie : `SendPayout` bornait deja son motif a 255, mais
localement, a un seul appel. `ConfirmPayout` ecrivait brut, et tout le cote
paiement aussi. La borne vit desormais dans les modeles `Payment` et `Payout` :
trois actions ecrivent ce champ, la quatrieme s'ecrira sans y penser. La colonne
des paiements passe par ailleurs a 255, pour s'aligner sur celle des
reversements.

Ce correctif a fait remonter un defaut dormant : le pont `Payout::booted()`
derivait un beneficiaire depuis `agency_id` en affirmant en commentaire que la
colonne n'etait pas nullable. Elle l'est devenue avec la generalisation des
reversements — un chauffeur independant ne releve d'aucune agence.

### Ce qui reste faux

`fallbackCode` (`packages/api-client/src/errors.ts`) rabat **tout statut non
traite sur `VALIDATION_FAILED`**, 500 compris : le passager lit « Certaines
informations sont incorrectes » sur une panne serveur. Le commentaire juste
au-dessus decrit pourtant l'inverse — « le code de repli suit donc le statut
HTTP » — et cite exactement ce piege. La fonction ne traite que 401, 403, 404 et
429.

C'est corrige : `SERVER_ERROR` traverse desormais la chaine — specification, types
generes, enum PHP, libelles fr et en — et `fallbackCode` traite les 5xx. Le code
n'est **jamais emis par l'API** : une erreur serveur ne passe pas par le rendu
d'erreur metier. Il existe pour que le client ait quelque chose d'honnete a
afficher quand la reponse ne porte aucun code. `isRetryable` le compte comme
reessayable : c'est le cas ou insister a le plus de chances d'aboutir.

**Et le `202` ne ment plus.** Le controleur le rendait quel que soit le statut,
refus compris : le journal montrait « accepte » pendant que l'ecran affichait
« paiement non abouti ». Un refus immediat de l'agregateur clot la tentative —
rien n'arrivera par webhook — et se rend donc en `200`. Le `202` reste reserve a
ce qui attend encore un code du payeur.

### La chaine complete, eprouvee

Le 19 aout 2026 : reservation, paiement, encaissement chez NotchPay, webhook,
rapprochement, **billet `TKT-T98HLQ` emis avec sa signature**. C'est le premier
parcours d'argent complet du projet.

---

## 10. État des lieux du web — 19 août 2026

Relevé sur le dépôt, pas de mémoire.

### Ce qui tient

Sept espaces existent et compilent : accueil public et fiche de départ,
connexion, embarquement, propriétaire, agence (neuf pages), administration
(quatre pages). 60 tests sur 12 fichiers, tous verts. Le paquet fait 379 Ko,
112 Ko compressés. Le service worker prend la coquille à l'installation et
n'a jamais mis en cache un appel d'API — la règle qui compte pour
l'embarquement.

### Le trou principal : rien de tout cela n'est en ligne

`render.yaml` ne déclare **qu'un seul service**, `motoboy-api`. Il n'existe
aucun site statique, aucune commande de construction du web, aucun domaine.
L'espace agence, l'administration, la PWA d'embarquement et les pages publiques
sont écrits, testés — et **hors d'atteinte de qui que ce soit**.

`VITE_API_URL` vaut par défaut `http://localhost:8000/api` : même déployé tel
quel, le web parlerait à une machine absente.

### Le second : la moitié de l'administration n'a pas d'écran

L'API expose 26 routes d'administration ; le web en consomme 13. Manquent,
par ordre de gravité :

| Ce qui manque | Conséquence |
|---|---|
| `admin/agencies` + `approve` + `reject` | **Aucune agence ne peut être admise.** Six routes, tout le parcours d'entrée d'une agence sur la plateforme |
| `admin/agencies/{ref}/commercial-terms` | La commission d'une agence ne se règle nulle part |
| `admin/agencies/{ref}/ledger-adjustments` | Aucun moyen de corriger une écriture comptable |
| `admin/settings` (+ pièces d'identité, commission course) | Les réglages de la plateforme ne s'atteignent pas |
| `admin/stations` + `moderate` | Les gares proposées par les agences ne se modèrent pas |
| `admin/city-requests` + `resolve` | Une agence peut demander une ville ; personne ne peut répondre |
| `admin/audit-logs` | Le journal d'audit existe et ne se lit pas |
| `admin/dashboard` | Aucune vue d'ensemble |

Côté agence la couverture est bonne : manquent `documents` (dépôt des pièces de
l'agence), `city-requests`, `tickets/lookup` et `bookings/{ref}/cancel`.

### Manques transverses

**Le web n'est pas bilingue.** Aucune trace d'`i18next` : tout le texte est
écrit en français dans les composants, là où le mobile passe par des catalogues.
Le produit se dit bilingue ; sa moitié web ne l'est pas.

**Douze composants sans test**, dont `SignInPage`, `OwnerPage`, `MoneyPage` et
`Scanner` — c'est-à-dire la connexion, l'argent et le lecteur de QR.

### Une erreur du présent document, corrigée

Il était écrit ailleurs que le taux d'annulation par agence était « calculé dans
l'API, jamais affiché ». **Il n'est calculé nulle part.** Le motif d'annulation
est bien collecté, et la spécification comme le contrôleur le justifient par ce
suivi — mais aucun code ne l'agrège. La donnée s'accumule sans lecteur.

---

## 11. L'administration, complétée — 19 août 2026

Les 13 endpoints d'administration qui n'avaient pas d'écran en ont un. Le
comptage de l'état des lieux tombe donc de « la moitié sans interface » à zéro.

| Écran | Ce qu'il débloque |
|---|---|
| **Agences** | L'admission. Six routes desservaient le parcours d'entrée sans qu'aucun écran ne les appelle : une agence pouvait déposer son dossier et personne ne pouvait y répondre |
| **Réglages** | Commission des courses et politique de pièce d'identité |
| **Référentiel** | Modération des gares, réponse aux demandes de ville |
| **Tableau de bord** | Ce qui attend une décision, séparé de ce qui décrit |
| **Journal d'audit** | Il était écrit et jamais lu |
| Reversements | Le bouton de construction manquait à la page existante |

L'administration reste **en français seul**, conformément au brief : usage
interne. Le rattrapage bilingue ne concerne que le public, l'agence et
l'embarquement.

### Deux points d'attention

**Le tableau de bord ne compte pas les chauffeurs en attente.** L'API ne renvoie
pas ce nombre. C'est aussi pourquoi il n'est pas devenu la page d'accueil du
back-office : y arriver aurait fait disparaître la file des dossiers de
chauffeur, décrite ailleurs comme « la seule barrière entre la plateforme et
quelqu'un dont personne n'a vu le permis ». Le test de `App.tsx` défendait cette
décision et a refusé la bascule — à juste titre.

**Les conditions commerciales sont éditables.** Le formulaire des quatorze champs
est écrit, et trois de ses champs changent de sens selon un autre — c'est tout
son intérêt :

- `commission_value` vaut des points de base ou des francs selon le mode ; le
  même 500 se lit « 5 % » ou « 500 F ».
- `cancellation_fee_value` de même, plafonné à 5 000 — soit 50 %, parce qu'une
  agence ne peut pas rendre une réservation intégralement non remboursable à
  l'intérieur de sa propre fenêtre d'annulation.
- `payout_day` est un **jour du mois** en mensuel et un **jour de la semaine** en
  hebdomadaire. La validation accepte 1 à 28 dans les deux cas : saisir 15 en
  hebdomadaire passe la validation, puis `BuildDuePayouts` le ramène à dimanche
  sans que rien ne le signale. D'où une liste de jours plutôt qu'un champ
  numérique.

**Seuls les champs modifiés sont transmis.** Toutes les règles de l'API sont en
`sometimes` : renvoyer l'objet entier écraserait ce qu'un autre administrateur
vient de changer entre le chargement de la page et l'enregistrement.

### Ce qui reste sur le web

Cinq endpoints d'agence sans écran — documents de l'agence, recherche de billet,
annulation d'une réservation, relevé de reversement, demande de ville — puis le
rattrapage bilingue et les composants encore sans test.

---

## 12. Les écrans d'agence — 19 août 2026

Cinq endpoints d'agence n'avaient pas d'écran. Quatre en ont un ; le cinquième
est écarté avec sa raison, et un sixième point reste bloqué côté API.

**Pièces de l'agence** — un écran neuf, et le premier envoi de fichier du web.
Sans lui, une agence pouvait s'inscrire et rester indéfiniment en attente sans
comprendre ce qui lui manquait : l'API acceptait les fichiers, personne ne pouvait
les envoyer. La liste énumère les types attendus **y compris ceux qui manquent**,
et la taille est vérifiée avant l'envoi — huit mégaoctets sur une connexion de
gare mettent une minute à monter pour être refusés à l'arrivée.

**Relevé de reversement** — un bouton sur la page Compte. Pas un lien : l'endpoint
est authentifié, et un `<a href>` partirait sans le jeton pour rapporter un 401
affiché hors de l'application. Le CSV passe donc par le client authentifié, puis
un objet mémoire qu'on révoque aussitôt.

**Annulation d'une réservation** — au guichet, en deux temps. La référence vient
du passager et non d'une liste : aucun endpoint d'agence ne liste les
réservations, et la liste d'embarquement rend des références de *billet*.
L'annulation est totale ; l'API accepte des `passenger_ids` pour n'annuler qu'une
partie d'un groupe, mais choisir lesquels suppose de les voir, ce que cet écran ne
permet pas encore.

### `tickets/lookup` : écarté, et pourquoi

La page d'embarquement porte déjà une saisie manuelle de référence, qui **valide**
le billet. `tickets/lookup` ne fait que le *consulter*. Ajouter un second
formulaire d'apparence identique à côté du premier, dont l'un embarque le passager
et l'autre non, invite à se tromper de champ au moment où l'on est pressé. À
reprendre le jour où le besoin de vérifier sans embarquer se manifestera vraiment.

### `agency/city-requests` : débloqué en étendant `/v1/config`

Le formulaire exige un `country_id` que rien n'exposait au client. Coder `1` en
dur fonctionnerait aujourd'hui — un seul pays est semé — et casserait
silencieusement à la première extension, en rattachant des demandes au mauvais
pays.

`/v1/config` rend donc maintenant les pays **actifs**, avec trois champs et pas un
de plus : cet endpoint est public et sa spécification le dit « volontairement
pauvre ». Le fuseau, la devise et l'indicatif ne changent rien à ce qui s'affiche.
Les pays inactifs sont écartés — en proposer un où l'on ne vend pas ferait déposer
une demande que personne n'accepterait, et l'agence attendrait une réponse qui ne
viendrait jamais.

Le sélecteur de pays ne s'affiche qu'au-delà d'un pays : en proposer un seul
demanderait un choix qui n'en est pas un.

`/v1/config` n'avait **aucun test**. Il en a trois.

### La clé d'idempotence, une par annulation

L'annulation exige un `Idempotency-Key`. Une clé unique par composant — le motif
employé ailleurs — ferait traiter la **seconde** annulation comme un rejeu de la
première : le serveur rendrait le résultat de l'autre réservation, et celle qu'on
visait resterait intacte en ayant l'air annulée. La clé est donc fixée à
l'ouverture de la confirmation, ce qui garde un second clic après coupure réseau
sur la même opération. Un test l'éprouve, et il échoue si la clé est figée.

---

## 13. Le web bilingue — 19 août 2026

Trois surfaces sur trois, conformément au brief : le comparateur public,
l'embarquement et l'espace agence. **L'administration reste en français seul** —
outil interne, décision du brief, et deux cents chaînes qu'on aurait traduites
pour personne.

| Catalogue | Ce qu'il couvre |
|---|---|
| `common` | Ce qui se lit à l'identique partout — existait déjà, partagé avec le mobile |
| `public` | Le comparateur : recherche et fiche de départ |
| `boarding` | La PWA du quai **et** la vue d'embarquement de l'agence |
| `agency` | Les dix pages du back-office d'agence |

### Ce qui rend la complétude vérifiable

Le type croisé `Record<Locale, XMessages>` fait travailler le compilateur dans les
deux dimensions : une clé présente en français et absente en anglais **casse la
compilation**. Un `tsc` propre sur `@motoboy/shared` n'est donc pas une promesse
de complétude, c'en est la preuve.

### Ce que le web fait que le mobile ne fait pas

**La langue survit au rechargement.** L'application garde son état ; un navigateur
repart de zéro à chaque F5. Un agent qui bascule l'embarquement en anglais puis
recharge — ce que fait précisément quelqu'un dont l'écran s'est figé — retrouverait
du français sans comprendre son erreur. Le choix est stocké, et `document.lang`
est posé : c'est ce qui fait prononcer la page correctement par un lecteur
d'écran.

Le sélecteur est **sur la première page vue** du public, et **dans l'en-tête de la
PWA** : celle-ci s'installe seule sur un écran d'accueil et tourne hors réseau, il
n'y a nulle part ailleurs où aller le chercher.

### Trois défauts du harnais de test, trouvés en chemin

1. Les tests affirmaient du français **par accident**, via `navigator.language`
   qui vaut `en-US` sous jsdom. Un verdict qui dépend des réglages de la machine ne
   prouve rien.
2. `changeLanguage` lancé sans être attendu faisait atterrir un rendu au milieu du
   test suivant : des tests passaient seuls et échouaient en suite, sans que rien
   ne pointe vers la langue.
3. Ce qui a révélé un défaut latent : `findBy*` disposait d'une seconde, et la
   suite alourdie dépassait ce budget une fois sur cinq — sur des assertions
   correctes.

### Ce qui n'est volontairement pas traduit

Les gabarits de référence (`TCK-XXXXXX`, `LT-4412-AB`, `MTB-XXXXXX`), les noms de
villes et les noms d'opérateurs. Un format ne change pas de langue.

---

## 14. Le web, couvert — 19 août 2026

**122 tests, zéro composant sans test** hormis le harnais lui-même. Les seize
composants découverts au relevé sont couverts, et six chaînes françaises de plus
ont été traduites au passage.

### Ce que les tests ont trouvé, et qu'aucune relecture n'avait vu

**`describeError` figeait la langue.** Elle était lue une seule fois, au
chargement du module, depuis `navigator.language` — jamais depuis le choix de
l'utilisateur. Quelqu'un qui basculait en anglais continuait de lire ses erreurs
en français. Le défaut restait invisible tant qu'aucune erreur ne survenait,
c'est-à-dire jusqu'au moment précis où l'on a besoin de comprendre.

**Un test existant passait grâce à ce défaut** : il affirmait contre
`resolveLocale(navigator.language)`, donc les deux côtés se trompaient de concert.

**Un `bodySerializer` mort dans `DocumentsPage`**, accompagné d'un commentaire
expliquant pourquoi il était nécessaire. Le test l'a démenti : la requête part en
multipart dans les deux cas.

**Six chaînes dans des ternaires**, invisibles à tout balayage orienté propriétés
— le mode de placement d'un véhicule, l'indice de recherche d'une ville, l'état
d'un siège tenu. Plus les libellés de type de pièce, logés dans une constante de
module.

### Deux limites de jsdom, écrites plutôt que combattues

`Request.formData()` ne s'y résout jamais : l'assertion porte donc sur la
frontière `multipart/form-data`, ce qui prouve davantage — elle n'existe que si le
corps était bien un `FormData`.

Le cas nominal du lecteur de QR exige de simuler `getUserMedia`,
`HTMLMediaElement.play` **et** `BarcodeDetector`. À ce compte-là un test n'éprouve
plus que ses propres simulacres : seuls les deux chemins d'échec sont couverts, et
le fichier dit pourquoi.

### Deux réglages du harnais

`testTimeout` relevé **au-dessus** d'`asyncUtilTimeout` : tous deux à cinq
secondes, un `findBy` sur le point d'aboutir se faisait tuer, en signalant un test
trop long là où il n'y avait qu'une machine chargée.

Et la langue est épinglée au français : `navigator.language` vaut `en-US` sous
jsdom, donc les tests affirmaient du français **par accident**.

### Ce qui n'est volontairement pas traduit

Les gabarits de référence — `TCK-XXXXXX`, `TR-XXXXXX`, `LT-4412-AB` — et
« Douala » comme exemple de saisie. Un format ne change pas de langue.
