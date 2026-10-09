# Pré-production (Render + Vercel) et production (Contabo)

| | Pré-production | Production |
|---|---|---|
| Hébergement | Render (API) + Vercel (site) | Contabo (tout, voir DEPLOY.md) |
| Branche Git | `deploy` | `main` |
| Adresse | `*.onrender.com` / `*.vercel.app` | `dataafriquehub.org` |
| Données | démonstration (comptes `@dah.com`) | réelles |
| Fichiers | Cloudinary (`MEDIA_STORAGE=cloudinary`, réglé dans Render) | disque du serveur |
| Emails | tous détournés vers une boîte de test | envoyés aux membres |
| Moteurs de recherche | exclue (`noindex`) | indexée |

## Cycle de travail

Le code est identique pour les deux : **aucune configuration de Render n'est dans le
dépôt** (elle se règle dans le tableau de bord de Render). Fusionner `deploy` dans
`main` n'apporte donc que du code.

```bash
git checkout deploy             # les nouveautés arrivent ici d'abord
git push origin deploy          # → Render + Vercel se mettent à jour : on teste
# quand tout est bon :
git checkout main && git merge deploy && git push origin main
# puis, sur le serveur Contabo : cd /opt/dah && git pull && dah up -d --build
```

## Réglages à faire une fois

### 1. Vercel (site de pré-production)

Projet Vercel → **Settings** :
- **Git → Production Branch** : `deploy`
- **Environment Variables** :
  - `NEXT_PUBLIC_API_BASE_URL` = `https://<service-render>.onrender.com`
  - `NEXT_PUBLIC_ENV` = `preprod` (pastille « Pré-production » + `noindex`)
- (Conseillé) **Git → Ignored Build Step** : `[ "$VERCEL_GIT_COMMIT_REF" != "deploy" ]`
  pour ne construire que la branche `deploy`.
- Redéployer.

### 2. Render (API de pré-production)

Service `dah-backend` → **Settings** :
- **Branch** : `deploy` (Render ne suit plus `main`)
- **Build Command** :
  ```
  pip install -r requirements/prod.txt && python manage.py migrate && python manage.py collectstatic --noinput && python manage.py seed_dah && python manage.py seed_engagement && python manage.py seed_treasury
  ```
  (données de démonstration ; sans effet si elles existent déjà)

**Environment** :
- `MEDIA_STORAGE` = `cloudinary` (le disque de Render est effacé à chaque redémarrage)
- `CLIENT_IP_HEADER` = `HTTP_CF_CONNECTING_IP` (Render est derrière Cloudflare)
- `EMAIL_REDIRECT_TO` = votre boîte de test (ex. `preprod@dataafriquehub.org`) — **obligatoire** :
  sans elle, la pré-production enverrait des emails à de vraies adresses.
  (Ou `EMAIL_ENABLED` = `false` pour n'envoyer aucun email.)
- `CORS_ALLOWED_ORIGINS` et `FRONTEND_URL` = l'adresse Vercel de pré-production.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` : déjà en place.
- `ENV` = `prod`, `ALLOWED_HOSTS`, `DATABASE_URL`, `BREVO_API_KEY` : déjà en place.
- `SECRET_KEY` : différente de celle de la production.

### 3. Données de la pré-production

La base Render contient aujourd'hui les **vraies données** (c'était la production).
Une fois la production installée sur Contabo **et les données reprises** (DEPLOY.md, étape 5) :

1. Render → **New → PostgreSQL** (nouvelle base, plan gratuit).
2. Service `dah-backend` → Environment → `DATABASE_URL` = l'*Internal Database URL* de la nouvelle base.
3. Redéployer : la commande de build crée les tables et les données de démonstration.
4. Supprimer l'ancienne base Render.

Ainsi, la pré-production ne contient plus aucune donnée personnelle réelle.

> Les bases PostgreSQL gratuites de Render expirent au bout de 30 jours : recréer
> la base (étapes 1 à 3) quand Render le signale — les données de démonstration
> se régénèrent toutes seules.

### 4. GitHub (conseillé)

Protéger `main` (Settings → Branches) : passage obligatoire par une *pull request*
depuis `deploy`, pour qu'aucune modification n'arrive en production sans avoir
été vue en pré-production.
