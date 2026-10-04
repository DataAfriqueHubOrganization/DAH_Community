#!/bin/sh
# Sauvegarde quotidienne : base de données + fichiers envoyés (publics et privés).
# Conserve les 14 dernières. À planifier (crontab -e) :
#   30 3 * * * /opt/dah/deploy/backup.sh >> /var/log/dah-backup.log 2>&1
set -e
cd "$(dirname "$0")"
. ./.env.prod
DEST="${BACKUP_DIR:-/var/backups/dah}"
STAMP="$(date +%Y-%m-%d_%H%M)"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"
mkdir -p "$DEST"
umask 077  # sauvegardes lisibles par root uniquement (données personnelles)

$COMPOSE exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom > "$DEST/db_$STAMP.dump"
$COMPOSE run --rm --no-deps --entrypoint "tar -czf - -C /app media private_media" backend > "$DEST/files_$STAMP.tar.gz"

find "$DEST" -name 'db_*.dump' -mtime +14 -delete
find "$DEST" -name 'files_*.tar.gz' -mtime +14 -delete
echo "$(date '+%F %T') sauvegarde OK → $DEST ($STAMP)"
