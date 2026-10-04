#!/bin/sh
# Premier certificat HTTPS (à lancer une seule fois, sur le serveur).
#   cd deploy && sh init-letsencrypt.sh
# nginx ne démarre pas sans certificat : on en crée un provisoire, on démarre
# nginx, puis Let's Encrypt délivre le vrai certificat (validation par le web).
set -e
cd "$(dirname "$0")"
. ./.env.prod
: "${DOMAIN:?DOMAIN manquant dans .env.prod}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL manquant dans .env.prod}"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"
LIVE="/etc/letsencrypt/live/$DOMAIN"

echo "→ Certificat provisoire pour $DOMAIN"
$COMPOSE run --rm -v "$(pwd)/make-dummy-cert.py:/tmp/make-dummy-cert.py:ro" \
  --entrypoint "python3 /tmp/make-dummy-cert.py $LIVE" certbot

echo "→ Démarrage de nginx (et des services)"
$COMPOSE up -d --build

echo "→ Demande du vrai certificat"
$COMPOSE run --rm --entrypoint "sh -c 'rm -rf $LIVE /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf'" certbot
$COMPOSE run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot \
  -d $DOMAIN -d www.$DOMAIN --email $LETSENCRYPT_EMAIL --agree-tos --no-eff-email --non-interactive" certbot

echo "→ Rechargement de nginx"
$COMPOSE exec nginx nginx -s reload
echo "✓ HTTPS actif : https://$DOMAIN"
