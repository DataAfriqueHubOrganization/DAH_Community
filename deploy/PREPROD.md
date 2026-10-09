# Pré-production (Render + Vercel) et production (Contabo)

| | Pré-production | Production |
|---|---|---|
| Hébergement | Render (API) + Vercel (site) | Contabo (tout, voir DEPLOY.md) |
| Branche Git | `deploy` | `main` |
| Adresse | `*.onrender.com` / `*.vercel.app` | `dataafriquehub.org` |
| Base de données | celle de Render, **séparée** | celle de Contabo, **séparée** |
| Fichiers | Cloudinary (`MEDIA_STORAGE=cloudinary`, réglé dans Render) | disque du serveur |
| Emails | envoyés aux vrais destinataires (sauf comptes de démo `@dah.com`) | envoyés aux membres |
| Moteurs de recherche | exclue (`noindex`) | indexée |

## Cycle de travail

Le code est identique pour les deux : **aucune configuration de Render n'est dans le
dépôt** (elle se règle dans le tableau de bord de Render). Fusionner `deploy` dans
`main` n'apporte donc que du code.

```bash
git switch deploy               # les nouveautés arrivent ici d'abord
git push origin deploy          # → Render + Vercel se mettent à jour : on teste
# quand tout est bon :
git switch main && git merge deploy && git push origin main
git switch deploy               # on revient travailler sur la pré-production
# puis, sur le serveur Contabo : cd /opt/dah && git pull && dah up -d --build
```

> La branche `deploy` porte le même nom que le dossier `deploy/` : utiliser
> `git switch` (et non `git checkout`), et `git log deploy --` pour l'historique.

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
  pip install -r requirements/prod.txt && python manage.py migrate && python manage.py collectstatic --noinput && python manage.py seed_dah --users-only
  ```
  (`--users-only` : crée seulement les comptes de démo s'ils manquent — aucun
  événement, article ou département de démo ; les données de Render restent intactes)

**Environment** :
- `MEDIA_STORAGE` = `cloudinary` (le disque de Render est effacé à chaque redémarrage)
- `CLIENT_IP_HEADER` = `HTTP_CF_CONNECTING_IP` (Render est derrière Cloudflare)
- Emails : envoyés au destinataire concerné, comme en production — **ne pas
  définir** `EMAIL_REDIRECT_TO`. Les comptes de démo (`@dah.com`) ne reçoivent
  jamais rien (adresses fictives).
  Options : `EMAIL_REDIRECT_TO` = une vraie boîte mail pour tout détourner vers
  elle (jamais l'identifiant SMTP `…@smtp-brevo.com`) ; `EMAIL_ENABLED` = `false`
  pour n'envoyer aucun email.
- `SEED_PASSWORD` = un mot de passe long, propre à la pré-production, pour les
  comptes de démo — **obligatoire** pour les seeds sur un serveur (voir ci-dessous).
- `CORS_ALLOWED_ORIGINS` et `FRONTEND_URL` = l'adresse Vercel de pré-production.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` : déjà en place.
- `ENV` = `prod`, `ALLOWED_HOSTS`, `DATABASE_URL`, `BREVO_API_KEY` : déjà en place.
- `SECRET_KEY` : différente de celle de la production.

### 3. Données : Render et Contabo ne se mélangent jamais

Chaque environnement a **sa propre base et ses propres fichiers** :

| | Render (pré-production) | Contabo (production) |
|---|---|---|
| Base | PostgreSQL de Render (`DATABASE_URL` dans Render) | PostgreSQL du serveur (volume Docker) |
| Fichiers | Cloudinary | disque du serveur |
| `SECRET_KEY` | la sienne | une autre |

- Aucun transfert de données dans un sens ou dans l'autre (pas de `pg_dump` /
  `pg_restore` entre les deux).
- Fusionner `deploy` dans `main` ne déplace que du **code** ; les **migrations**
  s'appliquent ensuite à chaque base, séparément.
- Un compte créé sur l'une n'existe pas sur l'autre.

> Les bases PostgreSQL gratuites de Render expirent : penser à la sauvegarder
> ou à passer sur un plan payant si ses données doivent être conservées.

### 4. Se connecter avec les comptes de démo

Les comptes du README (`admin@dah.com`, `president@dah.com`, `tresorier@dah.com`,
`alice@dah.com`…) existent sur la pré-production, **avec le mot de passe
`SEED_PASSWORD`** et non `Dah@2024!` : le dépôt est public, ce mot de passe est
connu de tous et ne sert qu'en local.

Si ces comptes existent déjà sur Render avec l'ancien mot de passe (anciens
déploiements), le remplacer une fois — Render → `dah-backend` → **Shell** :

```bash
python manage.py seed_dah --users-only --reset-passwords
```

Seuls les comptes `@dah.com` sont touchés. À relancer après chaque changement
de `SEED_PASSWORD`.

### 5. GitHub (conseillé)

Protéger `main` (Settings → Branches) : passage obligatoire par une *pull request*
depuis `deploy`, pour qu'aucune modification n'arrive en production sans avoir
été vue en pré-production.
