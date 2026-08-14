# syntax=docker/dockerfile:1
#
# Image de production de l'API MOTOBOY.
#
# Un seul conteneur sert les trois rôles — web, file d'attente, planificateur —
# choisis par `CONTAINER_ROLE`. C'est délibéré : le travail de fond n'est pas
# accessoire ici. Sans le planificateur, `ReleaseExpiredHolds` ne tourne plus et
# **l'inventaire se gèle** — un paiement abandonné immobilise sa place
# indéfiniment, et un car affiche complet sans avoir vendu un billet (B2).
#
# **Le contexte de build est la racine du dépôt**, pour une seule raison :
# `docs/openapi.yaml` est normatif et l'API le sert. L'y recopier sous
# `apps/api` créerait un second exemplaire qui divergerait au premier oubli.
# Tout le reste du monorepo est exclu par le `.dockerignore` de la racine.

# ─────────────────────────────── Dépendances ───────────────────────────────

FROM composer:2 AS vendor

WORKDIR /app

# Les manifestes d'abord : tant qu'ils ne changent pas, cette couche est
# réutilisée et l'installation n'est pas rejouée à chaque modification de code.
COPY apps/api/composer.json apps/api/composer.lock ./

RUN composer install \
      --no-dev \
      --no-scripts \
      --no-autoloader \
      --prefer-dist \
      --no-interaction \
      --no-progress

COPY apps/api .

# `--classmap-authoritative` : en production, aucune classe n'est cherchée sur le
# disque hors de la carte. Ce qui n'y figure pas n'existe pas — et rien ne doit y
# manquer.
#
# `--no-scripts` parce que le script de fin d'autoload démarre Laravel pour
# découvrir les paquets : l'image `composer` n'a pas les extensions du runtime,
# et cette découverte a sa place au démarrage du conteneur, pas ici.
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative --no-scripts

# ──────────────────────────────── Exécution ────────────────────────────────

FROM php:8.3-fpm-alpine AS runtime

# `pcntl` n'est pas décoratif : il permet à `queue:work` de traiter les signaux.
# Sans lui, un redéploiement tue le worker au milieu d'un job — ici, une
# notification d'annulation de départ à des dizaines de passagers.
RUN apk add --no-cache \
      nginx \
      supervisor \
      postgresql-libs \
      icu-libs \
      libzip \
  && apk add --no-cache --virtual .build-deps \
      $PHPIZE_DEPS \
      postgresql-dev \
      icu-dev \
      libzip-dev \
  && docker-php-ext-install -j"$(nproc)" \
      pdo_pgsql \
      pgsql \
      intl \
      zip \
      opcache \
      pcntl \
  && apk del .build-deps \
  && rm -rf /tmp/pear

COPY apps/api/docker/php.ini /usr/local/etc/php/conf.d/99-motoboy.ini
COPY apps/api/docker/php-fpm.conf /usr/local/etc/php-fpm.d/zz-motoboy.conf
COPY apps/api/docker/nginx.conf /etc/nginx/nginx.conf
COPY apps/api/docker/supervisord.conf /etc/supervisor/supervisord.conf
COPY apps/api/docker/entrypoint.sh /usr/local/bin/entrypoint

RUN chmod +x /usr/local/bin/entrypoint

WORKDIR /var/www/html

COPY --from=vendor /app .

# Le contrat, servi tel quel par `GET /openapi.yaml`. Une seule source, celle
# que les tests vérifient et dont le client TypeScript est généré.
#
# **Hors de `public/`, délibérément.** nginx sert ce répertoire directement :
# le fichier partirait avant d'atteindre Laravel, avec un type MIME générique et
# surtout **sans passer par l'interrupteur** `API_DOCS_ENABLED`, qui cesserait
# alors de fermer quoi que ce soit.
COPY docs/openapi.yaml storage/app/openapi.yaml

# `storage` et `bootstrap/cache` sont les deux seuls chemins que l'application
# écrit. Le reste du code reste en lecture seule pour l'utilisateur qui sert les
# requêtes.
RUN mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache \
  && chown -R www-data:www-data storage bootstrap/cache \
  && chmod -R 775 storage bootstrap/cache

ENV CONTAINER_ROLE=web \
    APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    PORT=8080

# Documentaire seulement : le port réellement écouté vient de `PORT`, que
# l'hébergeur impose. nginx est reconfiguré au démarrage.
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint"]
