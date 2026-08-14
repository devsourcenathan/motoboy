#!/usr/bin/env sh
#
# Vérification d'un déploiement de l'API MOTOBOY.
#
#   ./scripts/smoke.sh https://motoboy-api.onrender.com
#
# **Lecture seule.** Rien n'est créé, modifié ni supprimé : ce script se lance
# sur la production sans y penser à deux fois. Le parcours qui écrit — inscrire
# une agence, la valider, vendre — est décrit dans docs/DEPLOIEMENT.md, parce
# qu'il laisse des traces qu'il faut décider d'assumer.
#
# Sort en échec au premier contrôle raté, pour être utilisable dans une chaîne
# d'intégration.

set -eu

BASE="${1:-}"

if [ -z "${BASE}" ]; then
    echo "Usage : $0 <url-de-base>" >&2
    echo "Exemple : $0 https://motoboy-api.onrender.com" >&2
    exit 2
fi

BASE="${BASE%/}"
FAILURES=0

# ─────────────────────────────── Utilitaires ───────────────────────────────

# `--max-time 30` : une instance en veille met quelques secondes à répondre,
# mais pas trente. Au-delà, ce n'est plus un réveil.
fetch_status() {
    curl -s -o /tmp/smoke-body -w '%{http_code}' --max-time 30 \
        -H 'Accept: application/json' "$@" 2>/dev/null || echo "000"
}

check() {
    label="$1"
    expected="$2"
    shift 2

    actual="$(fetch_status "$@")"

    if [ "${actual}" = "${expected}" ]; then
        printf '  ✓ %-46s %s\n' "${label}" "${actual}"
        return 0
    fi

    printf '  ✗ %-46s %s (attendu %s)\n' "${label}" "${actual}" "${expected}"
    head -c 200 /tmp/smoke-body 2>/dev/null | sed 's/^/      /'
    echo
    FAILURES=$((FAILURES + 1))
    return 0
}

body_has() {
    grep -q "$1" /tmp/smoke-body 2>/dev/null
}

echo
echo "MOTOBOY — vérification de ${BASE}"
echo

# ──────────────────────────── Le service répond ────────────────────────────

echo "Service"
check "sonde de santé" 200 "${BASE}/up"
check "racine" 200 "${BASE}/"

# ─────────────────────── Le contrat d'erreurs est tenu ──────────────────────

echo
echo "Contrat"

# Sans en-tête `Accept` : c'est le cas qui renvoyait un 500 opaque tant que le
# middleware redirigeait vers une route `login` inexistante.
if [ "$(curl -s -o /tmp/smoke-body -w '%{http_code}' --max-time 30 "${BASE}/api/v1/me")" = "401" ] \
    && body_has 'UNAUTHENTICATED'; then
    printf '  ✓ %-46s %s\n' "401 typé sans en-tête Accept" "401"
else
    printf '  ✗ %-46s\n' "401 typé sans en-tête Accept"
    FAILURES=$((FAILURES + 1))
fi

check "référence inconnue → 404" 404 "${BASE}/api/v1/trips/INEXISTANT"
check "espace agence fermé au public" 401 "${BASE}/api/v1/agency/payouts"
check "administration fermée au public" 401 "${BASE}/api/v1/admin/dashboard"

# ─────────────────────────── Les données publiques ──────────────────────────

echo
echo "Référentiel"

status="$(fetch_status "${BASE}/api/v1/places/autocomplete?q=dou")"

if [ "${status}" != "200" ]; then
    printf '  ✗ %-46s %s (attendu 200)\n' "autocomplétion des villes" "${status}"
    FAILURES=$((FAILURES + 1))
elif body_has 'Douala'; then
    printf '  ✓ %-46s %s\n' "autocomplétion des villes" "200"
else
    printf '  ✗ %-46s %s\n' "autocomplétion — référentiel vide" "200"
    echo "      Le référentiel n'est pas seedé : lancer db:seed sur l'instance."
    echo "      Sans lui, la recherche ne renverra jamais rien."
    FAILURES=$((FAILURES + 1))
fi

# La recherche répond même sans offre : une liste vide est une réponse valable,
# une erreur ne l'est pas.
check "recherche (villes inconnues)" 422 "${BASE}/api/v1/search?origin_city_id=0&destination_city_id=0&date=2030-01-01"

# ────────────────────────────────── Bilan ──────────────────────────────────

echo
if [ "${FAILURES}" -eq 0 ]; then
    echo "Tout est vert."
    exit 0
fi

echo "${FAILURES} contrôle(s) en échec."
exit 1
