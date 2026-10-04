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
# Render est derrière Cloudflare (CF-Connecting-IP fiable). Sur un autre
# hébergement, définir CLIENT_IP_HEADER selon le proxy (ex. HTTP_X_REAL_IP avec nginx).
CLIENT_IP_HEADER = config(
    "CLIENT_IP_HEADER",
    default="HTTP_CF_CONNECTING_IP" if config("RENDER_EXTERNAL_HOSTNAME", default="") else "",
) or None

# Documentation de l'API réservée aux administrateurs en production.
SPECTACULAR_SETTINGS["SERVE_PERMISSIONS"] = ["rest_framework.permissions.IsAdminUser"]  # noqa: F405
SPECTACULAR_SETTINGS["SERVE_AUTHENTICATION"] = ["rest_framework.authentication.SessionAuthentication"]  # noqa: F405

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
# Désactivable (SECURE_SSL_REDIRECT=False) uniquement pour un smoke-test local
# de l'image de prod sans reverse proxy TLS devant — en production réelle
# (Render) cette variable n'est pas définie et on garde le défaut sécurisé.
SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)
SESSION_COOKIE_SECURE = SECURE_SSL_REDIRECT
CSRF_COOKIE_SECURE = SECURE_SSL_REDIRECT

# Render fournit automatiquement le hostname externe du service.
RENDER_EXTERNAL_HOSTNAME = config("RENDER_EXTERNAL_HOSTNAME", default="")
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)  # noqa

CSRF_TRUSTED_ORIGINS = [o for o in config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv()) if o]
if RENDER_EXTERNAL_HOSTNAME:
    CSRF_TRUSTED_ORIGINS.append(f"https://{RENDER_EXTERNAL_HOSTNAME}")

# WhiteNoise sert les fichiers statiques directement depuis Gunicorn (pas de Redis/nginx nécessaire).
# Cloudinary sert les fichiers média : le disque de Render n'est pas persistant
# (effacé à chaque redéploiement), ce qui rendait les fichiers uploadés (CV,
# avatars...) inaccessibles après coup malgré leur référence en base.
STORAGES = {
    "default": {"BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
# django-cloudinary-storage fournit sa propre commande collectstatic qui lit
# encore l'ancien setting STATICFILES_STORAGE (au lieu de STORAGES["staticfiles"])
# — sans ça, `manage.py collectstatic` plante avec AttributeError au build.
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
