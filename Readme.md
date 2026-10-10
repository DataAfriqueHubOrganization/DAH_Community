Démarrage en local

1. Prérequis

- Docker + Docker Compose installés
- Git pour cloner le repo

---
2. Configuration de l'environnement

Copier le fichier .env.example à la racine :

cp .env.example .env

Le .env par défaut fonctionne sans modification pour le développement local. Les valeurs importantes :

┌──────────────────────────┬─────────────────────────┬─────────────────────────┐
│         Variable         │    Valeur par défaut    │       Description       │
├──────────────────────────┼─────────────────────────┼─────────────────────────┤
│ DB_PASSWORD              │ dah_password            │ Mot de passe PostgreSQL │
├──────────────────────────┼─────────────────────────┼─────────────────────────┤
│ SECRET_KEY               │ change-me-in-production │ À ch
├──────────────────────────┼─────────────────────────┼─────
│ NEXT_PUBLIC_API_BASE_URL │ http://localhost:8000   │ URL
└──────────────────────────┴─────────────────────────┴─────

---
3. Démarrer tous les services

docker compose -f docker-compose.dev.yml up --build

Cela démarre en parallèle :
- PostgreSQL sur le port 5433
- Redis sur le port 6380
- Django sur http://localhost:8000 (migrations auto au déma
- Next.js sur http://localhost:3000
- Celery worker (emails asynchrones)

---
4. Charger les données de test (première fois)

Dans un autre terminal, une fois les services démarrés :

docker compose -f docker-compose.dev.yml exec backend pytho

Cela crée 10 utilisateurs, leurs profils, des événements et

---
5. Comptes de test

┌───────────────────┬────────────────┬──────────────┐
│       Email       │      Rôle      │ Mot de passe │
├───────────────────┼────────────────┼──────────────┤
│ admin@dah.com     │ Administrateur │ Dah@2024!    │
├───────────────────┼────────────────┼──────────────┤
│ president@dah.com │ Président      │ Dah@2024!    │
├───────────────────┼────────────────┼──────────────┤
│ alice@dah.com     │ Membre         │ Dah@2024!    │
├───────────────────┼────────────────┼──────────────┤
│ felix@dah.com     │ Candidat       │ Dah@2024!    │
└───────────────────┴────────────────┴──────────────┘

En local uniquement. Sur un serveur (pré-production), les mêmes comptes utilisent
le mot de passe `SEED_PASSWORD` défini chez l'hébergeur (voir deploy/PREPROD.md).

---
6. URLs utiles

┌───────────────────────┬─────────────────────────────────┐
│        Service        │               URL               │
├───────────────────────┼─────────────────────────────────┤
│ Application           │ http://localhost:3000           │
├───────────────────────┼─────────────────────────────────┤
│ API Django            │ http://localhost:8000/api/v1/   │
├───────────────────────┼─────────────────────────────────┤
│ Documentation Swagger │ http://localhost:8000/api/docs/ │
├───────────────────────┼─────────────────────────────────┤
│ Admin Django          │ http://localhost:8000/admin/    │
└───────────────────────┴─────────────────────────────────┘

---
Commandes utiles

# Arrêter les services
docker compose -f docker-compose.dev.yml down

# Voir les logs d'un service spécifique
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f frontend

# Relancer uniquement le backend (après modif Python)
docker compose -f docker-compose.dev.yml restart backend

# Créer de nouvelles migrations
docker compose -f docker-compose.dev.yml exec backend pytho

# Ouvrir un shell Django
docker compose -f docker-compose.dev.yml exec backend python manage.py shell