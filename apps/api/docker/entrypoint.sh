#!/bin/sh
#
# Démarrage du conteneur.
#
# Trois rôles depuis la même image, choisis par `CONTAINER_ROLE` : `web`,
# `worker`, `scheduler`. Le rôle `web` embarque les deux autres tant que le
# volume ne justifie pas de les séparer — c'est ce que fait `supervisord`.

set -e

php_artisan() {
    php /var/www/html/artisan "$@"
}

# Le port n'ouvre qu'après les migrations. Si celles-ci échouent, l'hébergeur ne
# voit qu'une absence de port et le dit sans jamais nommer la cause : ce message
# est là pour que la vraie raison figure dans le journal, juste au-dessus.
on_failure() {
    status=$?

    if [ "${status}" -eq 0 ]; then
        return 0
    fi

    echo "" >&2
    echo "Démarrage interrompu avant l'ouverture du port." >&2
    echo "L'hébergeur signalera « no open ports detected » : la cause réelle est" >&2
    echo "l'erreur ci-dessus, pas le port." >&2
}

trap on_failure EXIT INT TERM

# ────────────────────────────── Garde-fous ──────────────────────────────

if [ -z "${APP_KEY}" ]; then
    echo "APP_KEY manquante." >&2
    echo "Elle ne chiffre pas seulement les sessions : la clé de signature des" >&2
    echo "QR Codes en est dérivée. La changer invalide **tous** les billets déjà" >&2
    echo "émis, qui ne passeront plus l'embarquement." >&2
    exit 1
fi

# `DB_URL` et les variables discrètes ne se mélangent pas.
#
# L'URL ne remplace que ce qu'elle porte : les composants absents retombent sur
# `DB_HOST`, `DB_PORT`, etc. Une URL Neon n'indique pas de port — le port d'un
# `.env` local recopié ici l'emporte donc, et la connexion part vers le bon hôte
# sur le mauvais port. Le symptôme est un délai d'attente réseau qui ne nomme
# jamais la contradiction.
if [ -n "${DB_URL}" ] && { [ -n "${DB_HOST}" ] || [ -n "${DB_PORT}" ]; }; then
    echo "DB_URL est définie en même temps que DB_HOST ou DB_PORT." >&2
    echo "" >&2
    echo "  DB_HOST=${DB_HOST:-<absent>}" >&2
    echo "  DB_PORT=${DB_PORT:-<absent>}" >&2
    echo "" >&2
    echo "L'URL ne fournit que ce qu'elle contient ; le reste retombe sur ces" >&2
    echo "variables. Une URL Neon n'indiquant pas de port, un DB_PORT résiduel" >&2
    echo "envoie la connexion sur le mauvais port du bon serveur." >&2
    echo "" >&2
    echo "Supprimer DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME et DB_PASSWORD" >&2
    echo "de l'environnement : DB_URL suffit et fait foi." >&2
    exit 1
fi

# ─────────────────────────────── Préparation ───────────────────────────────

cd /var/www/html

# Port d'écoute imposé par l'hébergeur.
#
# Render annonce le port par `PORT` et scrute celui-là. Un port figé dans
# l'image laisse le service « en attente de détection de port » indéfiniment,
# sans erreur : rien n'écoute là où il regarde.
PORT="${PORT:-8080}"
sed -i "s/__PORT__/${PORT}/" /etc/nginx/nginx.conf

# L'URL publique vient de l'hébergeur. Elle sert à la génération d'URL — liens
# signés, notifications — et non au routage : la renseigner à la main
# obligerait à la corriger au premier changement de domaine.
if [ -z "${APP_URL}" ] && [ -n "${RENDER_EXTERNAL_URL}" ]; then
    APP_URL="${RENDER_EXTERNAL_URL}"
    export APP_URL
fi

# Découverte des paquets : elle démarre Laravel, donc elle a besoin des
# extensions du runtime — d'où sa place ici plutôt qu'à la construction.
php_artisan package:discover --ansi

# Caches construits **au démarrage**, jamais à la construction de l'image : la
# mise en cache de la configuration fige les valeurs d'environnement, et celles
# de production ne sont pas connues au moment du build.
php_artisan config:cache
php_artisan route:cache
php_artisan event:cache

# ─────────────────────────────── Migrations ───────────────────────────────
#
# `--isolated` prend un verrou partagé pour que deux conteneurs démarrant
# ensemble — le cas normal d'un redéploiement — ne jouent qu'une seule série.
#
# ⚠️ Mais ce verrou vit dans `cache_locks`, une table que **ces migrations
# créent**. Sur une base vierge, `--isolated` échoue donc avant d'avoir rien
# migré, sur une erreur qui parle de cache là où le problème est ailleurs. La
# toute première passe se fait sans verrou : il n'y a de toute façon rien à
# protéger tant que la base est vide.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "Connexion à la base et migrations…"

    if php_artisan migrate:status >/dev/null 2>&1; then
        php_artisan migrate --force --isolated
    else
        echo "Base vierge : première migration sans verrou d'isolation."
        php_artisan migrate --force
    fi

    echo "Migrations à jour."
fi

# ──────────────────────────────── Démarrage ────────────────────────────────

case "${CONTAINER_ROLE:-web}" in
    web)
        echo "MOTOBOY API — écoute sur le port ${PORT}."
        exec supervisord -c /etc/supervisor/supervisord.conf
        ;;
    worker)
        # `--max-time` fait redémarrer le worker chaque heure : un processus PHP
        # de longue durée finit par garder en mémoire un état qui n'a plus lieu
        # d'être, et le redémarrage coûte moins cher que le déboguer.
        exec php /var/www/html/artisan queue:work --tries=3 --max-time=3600 --sleep=3
        ;;
    scheduler)
        exec php /var/www/html/artisan schedule:work
        ;;
    *)
        echo "CONTAINER_ROLE inconnu : « ${CONTAINER_ROLE} »." >&2
        exit 1
        ;;
esac
