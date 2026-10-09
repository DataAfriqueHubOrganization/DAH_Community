# Déploiement sur un serveur (Contabo)

> Production. La pré-production (Render + Vercel, branche `deploy`) est décrite dans PREPROD.md.

Tout tourne dans Docker sur un seul serveur, derrière un seul domaine :

```
Internet ──HTTPS──> nginx ──┬── /api, /admin, /static ──> backend (Django + Gunicorn)
                            ├── /media  (fichiers publics, servis par nginx)
                            ├── /protected (documents privés, uniquement via un lien signé de Django)
                            └── le reste ──> frontend (Next.js)
                 backend ──> db (PostgreSQL, non exposée)
```

Les fichiers envoyés (avatars, couvertures, CV, preuves de paiement, justificatifs)
sont stockés sur le disque du serveur, dans des volumes Docker persistants
(`MEDIA_STORAGE=local`, posé par docker-compose.prod.yml). Les
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

## 5. Base de données (propre à Contabo)

La production sur Contabo a **sa propre base**, indépendante de celle de Render :
on n'importe rien depuis Render et on n'envoie rien vers Render. Les deux
environnements ne partagent ni base, ni fichiers, ni `SECRET_KEY`.

Au premier démarrage, la base est vide (les tables sont créées automatiquement).
Créer le premier administrateur :

```bash
dah exec backend python manage.py createsuperuser
```

> Ne jamais lancer de commande de seed (`seed_dah`, `seed_engagement`,
> `seed_treasury`) en production : elles créent des comptes de démonstration.

## 5 bis. Annuaire public des membres

Les profils sont masqués par défaut : chacun choisit d'apparaître sur le site
(Mon profil → « Apparaître dans l'annuaire public »). Pour inviter les membres
à faire ce choix — **en production uniquement**, une seule fois par membre :

```bash
dah exec backend python manage.py invite_public_profiles --dry-run   # qui sera invité
dah exec backend python manage.py invite_public_profiles
```

La commande respecte le quota d'emails du jour : s'il reste des membres à inviter,
la relancer le lendemain (aucun doublon).

## 6. Bascule

- Vérifier le site : `https://dataafriquehub.org`, connexion, une page de l'espace membre.
- Render et Vercel deviennent la **pré-production** (branche `deploy`), avec leurs propres données : voir PREPROD.md.
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
