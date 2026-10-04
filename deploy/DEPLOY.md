# Déploiement sur un serveur (Contabo)

Tout tourne dans Docker sur un seul serveur, derrière un seul domaine :

```
Internet ──HTTPS──> nginx ──┬── /api, /admin, /static ──> backend (Django + Gunicorn)
                            ├── /media  (fichiers publics, servis par nginx)
                            ├── /protected (documents privés, uniquement via un lien signé de Django)
                            └── le reste ──> frontend (Next.js)
                 backend ──> db (PostgreSQL, non exposée)
```

Les fichiers envoyés (avatars, couvertures, CV, preuves de paiement, justificatifs)
sont stockés sur le disque du serveur, dans des volumes Docker persistants. Les
documents sensibles sont dans un dossier séparé, jamais accessible directement.

---

## 1. Préparer le serveur (Ubuntu 24.04, une seule fois)

```bash
# Mises à jour + outils de sécurité
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw fail2ban unattended-upgrades git
sudo dpkg-reconfigure -plow unattended-upgrades      # mises à jour de sécurité automatiques

# Utilisateur dédié (ne pas travailler en root)
sudo adduser dah && sudo usermod -aG sudo dah
# Copier votre clé SSH publique pour cet utilisateur, depuis votre ordinateur :
#   ssh-copy-id dah@IP_DU_SERVEUR

# SSH par clé uniquement (vérifier d'abord que la connexion par clé fonctionne !)
sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/; s/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Pare-feu : SSH, HTTP, HTTPS uniquement
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable

# Docker (dépôt officiel)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker dah     # se déconnecter / reconnecter ensuite
```

## 2. Nom de domaine

Chez le registrar, créer deux enregistrements **A** (et **AAAA** si IPv6) vers l'IP du serveur :
`dataafriquehub.org` et `www.dataafriquehub.org`. Attendre qu'ils répondent (`ping dataafriquehub.org`).

## 3. Code et configuration

```bash
sudo mkdir -p /opt/dah && sudo chown dah:dah /opt/dah
git clone <URL_DU_DEPOT> /opt/dah && cd /opt/dah/deploy
cp .env.prod.example .env.prod && chmod 600 .env.prod
nano .env.prod      # remplir DOMAIN, SECRET_KEY, DB_PASSWORD, BREVO_API_KEY…
```

`SECRET_KEY` et `DB_PASSWORD` : valeurs longues et aléatoires, par exemple
`python3 -c "import secrets; print(secrets.token_urlsafe(64))"`.

## 4. Premier démarrage (HTTPS compris)

```bash
cd /opt/dah/deploy
sh init-letsencrypt.sh
```

Le script construit les images, démarre tout et obtient le certificat Let's Encrypt
(renouvelé ensuite automatiquement par le service `certbot`).

Raccourci utilisé dans la suite :

```bash
alias dah='docker compose -f /opt/dah/deploy/docker-compose.prod.yml --env-file /opt/dah/deploy/.env.prod'
```

## 5. Reprendre les données de Render

1. Render → base PostgreSQL → **External Database URL** (copier).
2. Sur le serveur :

```bash
cd /opt/dah/deploy
docker run --rm postgres:16-alpine pg_dump "URL_EXTERNE_RENDER" --format=custom > render.dump
dah exec -T db pg_restore -U dah -d dah_db --clean --if-exists --no-owner < render.dump
dah restart backend                     # applique les migrations
dah exec backend python manage.py cleanup_media --dry-run
dah exec backend python manage.py cleanup_media
rm render.dump
```

`cleanup_media` vide les références aux anciens fichiers Cloudinary (abandonnés) :
le site affiche l'image par défaut, et chacun peut renvoyer son avatar, son CV…

Sans reprise de données : créer le premier administrateur avec
`dah exec backend python manage.py createsuperuser`.

## 6. Bascule

- Vérifier le site : `https://dataafriquehub.org`, connexion, une page de l'espace membre.
- Arrêter le service Render et le projet Vercel (une seule production à la fois).
- Les emails pointent vers `FRONTEND_URL` : vérifier qu'il vaut bien le nouveau domaine.

## 7. Sauvegardes (indispensable)

```bash
crontab -e
# chaque nuit à 3 h 30 : base + fichiers, 14 jours conservés
30 3 * * * /opt/dah/deploy/backup.sh >> /var/log/dah-backup.log 2>&1
```

Les sauvegardes sont dans `BACKUP_DIR` (par défaut `/var/backups/dah`).
**Copiez-les aussi hors du serveur** (autre machine, stockage objet…) : une panne
du disque emporterait sinon données et sauvegardes.

Restauration :

```bash
dah exec -T db pg_restore -U dah -d dah_db --clean --if-exists --no-owner < /var/backups/dah/db_AAAA-MM-JJ_HHMM.dump
dah run --rm --no-deps -T --entrypoint "tar -xzf - -C /app" backend < /var/backups/dah/files_AAAA-MM-JJ_HHMM.tar.gz
dah restart backend
```

## 8. Mises à jour

```bash
cd /opt/dah && git pull
dah up -d --build          # reconstruit et redémarre ; migrations au démarrage du backend
dah image prune -f         # nettoie les anciennes images
```

## 9. Au quotidien

| Besoin | Commande |
|---|---|
| Journaux de l'API | `dah logs -f backend` |
| Journaux nginx | `dah logs -f nginx` |
| État des services | `dah ps` |
| Console Django | `dah exec backend python manage.py shell` |
| Espace disque | `df -h` et `docker system df` |
