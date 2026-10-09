from .base import *  # noqa
from decouple import config, Csv
from django.core.exceptions import ImproperlyConfigured

DEBUG = False

# Jamais la clé de développement en production : les jetons (sessions, liens
# de réinitialisation) seraient falsifiables.
SECRET_KEY = config("SECRET_KEY", default="")
if not SECRET_KEY or SECRET_KEY.startswith("dev-insecure"):
    raise ImproperlyConfigured("SECRET_KEY doit être défini dans les variables d'environnement.")

# Render termine le HTTPS : sans cet en-tête, Django croit chaque requête en
# HTTP (redirections en boucle, liens absolus en http://).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# Un proxy devant l'application : IP réelle du client pour les quotas.
REST_FRAMEWORK["NUM_PROXIES"] = 1  # noqa: F405
# En-tête portant l'IP réelle, selon le proxy de l'hébergeur (ex. HTTP_X_REAL_IP
# avec nginx, HTTP_CF_CONNECTING_IP derrière Cloudflare). Vide par défaut.
CLIENT_IP_HEADER = config("CLIENT_IP_HEADER", default="") or None

# Documentation de l'API réservée aux administrateurs en production.
SPECTACULAR_SETTINGS["SERVE_PERMISSIONS"] = ["rest_framework.permissions.IsAdminUser"]  # noqa: F405
SPECTACULAR_SETTINGS["SERVE_AUTHENTICATION"] = ["rest_framework.authentication.SessionAuthentication"]  # noqa: F405

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Render fournit automatiquement le hostname externe du service.
RENDER_EXTERNAL_HOSTNAME = config("RENDER_EXTERNAL_HOSTNAME", default="")
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)  # noqa

CSRF_TRUSTED_ORIGINS = [o for o in config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv()) if o]
if RENDER_EXTERNAL_HOSTNAME:
    CSRF_TRUSTED_ORIGINS.append(f"https://{RENDER_EXTERNAL_HOSTNAME}")

# Fichiers envoyés : disque du serveur par défaut (volumes persistants — voir
# deploy/). MEDIA_STORAGE=cloudinary pour un hébergeur sans disque persistant
# (réglé dans l'environnement de l'hébergeur, pas dans le code).
MEDIA_STORAGE = config("MEDIA_STORAGE", default="local")
# WhiteNoise sert les fichiers statiques depuis Gunicorn.
STORAGES = {
    "default": {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage"
        if MEDIA_STORAGE == "cloudinary" else "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
if MEDIA_STORAGE == "cloudinary":
    # django-cloudinary-storage lit encore l'ancien réglage dans sa commande
    # collectstatic (sinon AttributeError au build).
    STATICFILES_STORAGE = STORAGES["staticfiles"]["BACKEND"]

# Pas de worker Celery/Redis déployé sur ce plan gratuit : les tâches (emails)
# s'exécutent de façon synchrone dans la requête, via l'API HTTP de Brevo.
# EAGER_PROPAGATES=True est nécessaire : sans ça, toute erreur d'envoi (réseau,
# API down...) est avalée silencieusement par Celery en mode eager et n'atteint
# jamais les try/except qui sont censés la loguer (aucune erreur ni confirmation
# n'apparaît alors dans les logs). Les appelants (.delay()) sont déjà tous protégés
# par un try/except (ou fire_and_forget), donc une erreur d'email ne fait pas
# planter la requête HTTP.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Les emails sont envoyés via l'API HTTP de Brevo (apps.common.email), pas via le
# backend SMTP de Django — voir settings.BREVO_API_KEY dans base.py.
