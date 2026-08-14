# Déploiement — Render + Neon

> **Ce qui est déployé** : l'API seule. Les applications web et mobile n'existent
> pas encore.
>
> **Dernière mise à jour** — 14 août 2026

---

## 1. Ce qui tourne où

| Élément | Où | Note |
|---|---|---|
| API | Render, service web Docker | `apps/api/Dockerfile`, blueprint `render.yaml` |
| Base de données | Neon | PostgreSQL 17, hors de Render |
| File d'attente | dans le conteneur web | table `jobs`, pas de Redis |
| Planificateur | dans le conteneur web | `schedule:work` sous `supervisord` |
| Documents d'agence | Cloudflare R2 | **obligatoire** — voir §4 |

**Un seul conteneur sert les trois rôles.** Ce n'est pas de l'économie : le
travail de fond n'est pas accessoire ici. Sans planificateur,
[`ReleaseExpiredHolds`](../apps/api/app/Modules/Bookings/Actions/ReleaseExpiredHolds.php)
ne tourne plus et **l'inventaire se gèle** — un paiement Mobile Money abandonné
immobilise sa place indéfiniment, et un car affiche complet sans avoir vendu un
billet ([B2](BRIEF.md)). Un déploiement web-seul casse le produit sans qu'aucune
erreur ne le signale.

Le jour où le volume le justifie : deux services de fond avec la même image et
`CONTAINER_ROLE=worker` / `scheduler`, et `RUN_QUEUE=false` /
`RUN_SCHEDULER=false` sur le service web.

---

## 2. Neon

### La chaîne de connexion

Neon fournit une URL complète. Elle va dans `DB_URL`, telle quelle :

```
postgresql://<user>:<password>@<endpoint>.eu-central-1.aws.neon.tech/<db>?sslmode=require
```

### ⚠️ `DB_URL` seule — pas de `DB_HOST` ni de `DB_PORT` à côté

**L'URL ne remplace que ce qu'elle contient.** Les composants absents retombent
sur les variables discrètes. Or une URL Neon **n'indique pas de port** : un
`DB_PORT` résiduel — celui d'un `.env` local recopié dans l'interface, par
exemple `5433` — envoie donc la connexion sur le **mauvais port du bon
serveur**.

Le symptôme est un délai d'attente réseau qui ne nomme jamais la contradiction :

```
connection to server at "ep-....aws.neon.tech" (3.23.109.155), port 5433 failed:
timeout expired
```

Le conteneur refuse désormais de démarrer sur cette combinaison, en la nommant.
Dans l'environnement Render, **seule `DB_URL` doit exister** : supprimer
`DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` et `DB_PASSWORD`.

### Endpoint direct, pas le pooler

Neon expose deux endpoints : le direct et le **pooler**, reconnaissable au
suffixe `-pooler` dans l'hôte. **Utiliser le direct.**

Le pooler est un PgBouncer en mode transaction, où les requêtes préparées côté
serveur — ce que fait PDO par défaut — se marchent dessus d'une connexion à
l'autre, avec des erreurs intermittentes du type « prepared statement already
exists ». Avec huit processus PHP (`pm.max_children`), l'endpoint direct suffit
très largement.

Y passer un jour demandera d'émuler les requêtes préparées côté PDO, **et de le
vérifier** — pas de le supposer.

### Le nombre de connexions

Le plafond est `pm.max_children` × nombre d'instances, plus une pour le worker et
une pour le planificateur. Avec une instance : **dix connexions**. Augmenter le
nombre d'instances sur Render augmente ce total d'autant — c'est la borne à
surveiller avant toute montée en charge.

### La mise en veille

Neon endort une base inactive. La première requête après une période creuse paie
quelques centaines de millisecondes de réveil. Sans effet ici : le planificateur
interroge la base à la minute, donc elle ne dort jamais vraiment.

---

## 3. Variables d'environnement

`render.yaml` porte tout ce qui n'est pas secret. Les six valeurs marquées
`sync: false` se saisissent dans l'interface de Render :

| Variable | Source |
|---|---|
| `DB_URL` | Neon |
| `R2_ACCESS_KEY_ID` | Cloudflare |
| `R2_SECRET_ACCESS_KEY` | Cloudflare |
| `R2_BUCKET` | Cloudflare |
| `R2_ENDPOINT` | Cloudflare — `https://<account_id>.r2.cloudflarestorage.com` |

### ⚠️ `APP_KEY`

Render la génère à la première création du service. **Ne jamais la régénérer
ensuite.**

Elle ne chiffre pas seulement les sessions : la clé de signature des QR Codes en
est dérivée par séparation de domaine
([`QrPayload`](../apps/api/app/Modules/Tickets/Support/QrPayload.php)). La
changer invalide **tous les billets déjà émis**, qui ne passeront plus
l'embarquement — et le problème se découvre en gare, pas au déploiement.

---

## 4. Cloudflare R2

`DOCUMENTS_DISK=r2` est **obligatoire en production**. Le système de fichiers
d'un conteneur Render est éphémère : un document d'agence déposé sur le disque
local disparaît au redéploiement suivant, et le dossier de validation avec lui.

Le bucket doit rester **privé**. Un registre de commerce ou une pièce d'identité
de dirigeant ne s'atteint pas par une URL permanente : la consultation passe par
une URL signée à durée limitée.

---

## 5. Ce qui se passe au démarrage d'un conteneur

1. Refus immédiat si `APP_KEY` est absente.
2. **nginx est reconfiguré pour écouter sur `PORT`.** Render choisit le port et
   l'annonce par cette variable ; un port figé dans l'image laisse le service
   « en attente de détection de port » indéfiniment, sans qu'aucune erreur ne
   soit émise — rien n'écoute là où l'hébergeur regarde.
3. `package:discover`, puis mise en cache de la configuration, des routes et des
   événements. **Au démarrage, jamais à la construction de l'image** : mettre la
   configuration en cache fige les valeurs d'environnement, et celles de
   production ne sont pas connues au moment du build.
4. Les migrations. Le verrou d'isolation est partagé par le cache en base :
   deux conteneurs qui démarrent ensemble — le cas normal d'un redéploiement —
   n'en jouent qu'une seule série.

   **Sauf à la toute première.** Ce verrou vit dans `cache_locks`, une table que
   ces migrations créent : sur une base vierge, `--isolated` échoue avant
   d'avoir rien migré, sur une erreur qui parle de cache là où le problème est
   ailleurs. La première passe se fait donc sans verrou — il n'y a de toute
   façon rien à protéger tant que la base est vide.
5. `supervisord` lance nginx, php-fpm, le planificateur et le worker.

Le blueprint pointe la sonde de santé sur `/up`.

---

## 6. Mise en service

1. Créer la base sur Neon, récupérer l'URL de l'endpoint **direct**.
2. Créer le bucket R2 et un jeton d'accès.
3. Sur Render : *New → Blueprint*, pointer sur le dépôt. `render.yaml` est lu à
   la racine.
4. Saisir les cinq secrets.
5. Déployer. Les migrations tournent au premier démarrage.
6. Seeder le référentiel — pays, villes, rôles et permissions :

```bash
render exec motoboy-api -- php artisan db:seed --force
```

7. Créer le premier super administrateur. Il n'y a pas d'endpoint pour cela, et
   c'est délibéré : une route qui fabrique un super administrateur ne peut être
   protégée que par un secret, qui finit dans un dépôt ou un historique de
   commandes. Une commande console n'est atteignable que par quelqu'un qui a
   déjà accès au serveur.

```bash
php artisan motoboy:create-admin +237690000000 --super --first-name=Nathan --last-name=Tchinda
```

---

## 6 bis. Vérifier un déploiement

### La documentation du contrat

`https://<service>.onrender.com/docs` — l'interface Swagger, sur le contrat qui
fait foi. Le fichier servi par `/openapi.yaml` est **le même** que celui dont le
client TypeScript est généré et dont un test compare les chemins aux routes
réellement servies : une documentation dérivée d'autre chose finirait par
décrire un produit qui n'existe pas.

Ouverte par défaut — le contrat n'est pas un secret, et le cacher n'empêche
personne de découvrir les routes. `API_DOCS_ENABLED=false` la ferme.

### En une commande

```bash
./scripts/smoke.sh https://motoboy-api.onrender.com
```

**Lecture seule** : rien n'est créé ni modifié, le script se lance sur la
production sans y penser à deux fois. Il sort en échec au premier contrôle raté,
donc il s'enchaîne dans une CI.

Il vérifie que le service répond, que le contrat d'erreurs est tenu — dont le
401 typé **sans en-tête `Accept`**, le cas qui renvoyait un 500 opaque —, que
les espaces agence et administration sont fermés au public, et que le
référentiel est peuplé.

### Une base fraîche ne renvoie rien, et ce n'est pas une panne

Le référentiel — pays, villes, rôles, permissions — n'est pas dans les
migrations. Tant qu'il n'est pas seedé, l'autocomplétion renvoie une liste vide
et la recherche ne trouve jamais rien. Le script le dit explicitement plutôt que
de laisser conclure à un bug.

```bash
php artisan db:seed --force
```

Idempotent, et rejouable à chaque déploiement : ces seeders sont la source de
vérité de la table rôles/permissions. Les données de démonstration sont ignorées
hors développement — la garde est portée par l'environnement, pas par la
discipline.

### Se connecter réellement

Aucun prestataire SMS n'est branché : `SMS_DRIVER=log` écrit le message dans les
journaux du service. C'est là qu'on lit le code, et c'est ce qui permet
d'exercer le parcours complet sans dépenser un SMS.

```bash
# 1. Créer le compte, une fois
php artisan motoboy:create-admin +237690000000 --super

# 2. Demander un code
curl -X POST https://motoboy-api.onrender.com/api/v1/auth/login \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"phone":"+237690000000"}'

# 3. Lire le code dans les journaux Render, puis échanger contre un jeton
curl -X POST https://motoboy-api.onrender.com/api/v1/auth/otp/verify \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"phone":"+237690000000","code":"123456","purpose":"LOGIN"}'

# 4. L'espace administration répond
curl https://motoboy-api.onrender.com/api/v1/admin/dashboard \
  -H 'Accept: application/json' -H "Authorization: Bearer <jeton>"
```

### Le parcours qui écrit

Inscrire une agence, la valider, saisir un véhicule et un horaire, générer les
départs, réserver, payer, embarquer. Il laisse des traces qu'il faut décider
d'assumer sur l'instance visée — d'où son absence du script.

Un point à connaître : **le paiement n'aboutira pas.** Le pilote factice
reproduit le trait qui compte — rien n'est encaissé de façon synchrone — et
laisse la réservation en attente. C'est le comportement voulu, pas une panne,
et il le restera tant que l'agrégateur n'est pas choisi.

---

## 6 ter. Quand le déploiement reste bloqué sur « no open ports detected »

**Le port n'ouvre qu'après les migrations.** Tout ce qui échoue avant — clé
absente, base injoignable, migration en erreur — se manifeste donc par une
absence de port, et l'hébergeur ne rapporte que cela. La cause réelle est
**au-dessus** dans le journal, et le point d'entrée le dit explicitement avant
de rendre la main.

Ordre de lecture :

1. `APP_KEY manquante.` — refus volontaire.
2. `DB_URL est définie en même temps que DB_HOST ou DB_PORT.` — supprimer les
   variables discrètes, voir §2.
3. `Connexion à la base et migrations…` sans rien après : c'est la base.
   Vérifier `DB_URL`, et qu'elle pointe l'endpoint **direct** de Neon.
4. `Migrations à jour.` puis `écoute sur le port N` : le démarrage est allé au
   bout, et le problème est ailleurs.

**Un hôte qui absorbe les paquets sans les refuser met environ 85 secondes à
échouer** — c'est la reprise TCP du système, que l'application ne contrôle pas.
Une vraie erreur de configuration — mot de passe faux, hôte inconnu — échoue en
quelques secondes.

---

## 7. Ce qui n'est pas fait

- **Aucun prestataire n'est branché.** Les pilotes factices restent actifs :
  `PAYMENT_GATEWAY=fake`, `PAYOUT_GATEWAY=fake`, `SMS_DRIVER=log`. Ils ne
  simulent pas un succès — un paiement reste en attente, un SMS part dans les
  journaux. Le déploiement n'attend donc pas le choix de l'agrégateur, mais
  **rien ne s'encaisse réellement** tant qu'il n'est pas fait.
- **Pas de suivi d'erreurs.** [I7](BRIEF.md) en fait une brique non négociable
  sur un produit qui encaisse de l'argent et dépend de webhooks tiers. Les
  journaux de Render ne remplacent pas un outil de suivi : ils ne dédupliquent
  rien, n'alertent pas, et se perdent.
- **Pas de supervision des files.** Un worker bloqué ne se signale pas.
- **Pas de sauvegarde vérifiée.** Neon garde un historique de restauration ; il
  n'a jamais été exercé.
- **Pas de domaine ni de HTTPS propre** — l'URL `onrender.com` par défaut.
