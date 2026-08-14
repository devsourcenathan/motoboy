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

# ────────────────────────────── Garde-fous ──────────────────────────────

if [ -z "${APP_KEY}" ]; then
    echo "APP_KEY manquante." >&2
    echo "Elle ne chiffre pas seulement les sessions : la clé de signature des" >&2
    echo "QR Codes en est dérivée. La changer invalide **tous** les billets déjà" >&2
    echo "émis, qui ne passeront plus l'embarquement." >&2
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

# Les migrations tournent depuis n'importe quel rôle, mais `--isolated` prend un
# verrou partagé : deux conteneurs qui démarrent en même temps — le cas normal
# d'un redéploiement — n'en jouent qu'une seule série.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    php_artisan migrate --force --isolated
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
