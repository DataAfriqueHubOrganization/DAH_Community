from pathlib import Path
from datetime import timedelta
from decouple import config, Csv
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("SECRET_KEY", default="dev-insecure-key-change-in-prod")

DEBUG = False

ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())

# ─── Applications ────────────────────────────────────────────────
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "django_celery_beat",
    "django_extensions",
    "cloudinary",
]

LOCAL_APPS = [
    "apps.common",
    "apps.accounts",
    "apps.members",
    "apps.events",
    "apps.memberships",
    "apps.payments",
    "apps.certificates",
    "apps.departments",
    "apps.documents",
    "apps.notifications",
    "apps.portfolios",
    "apps.blog",
    "apps.projects",
    "apps.engagement",
    "apps.mailing",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ─── Middleware ───────────────────────────────────────────────────
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "apps.common.middleware.MaxRequestSizeMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ─── Base de données ─────────────────────────────────────────────
# DATABASE_URL est fourni automatiquement par Render (Postgres lié au service).
# En local (docker-compose), on retombe sur les variables DB_* individuelles.
_default_db_url = "postgres://{}:{}@{}:{}/{}".format(
    config("DB_USER", default="dah"),
    config("DB_PASSWORD", default="dah_password"),
    config("DB_HOST", default="localhost"),
    config("DB_PORT", default="5432"),
    config("DB_NAME", default="dah_db"),
)

DATABASES = {
    "default": dj_database_url.config(default=_default_db_url, conn_max_age=600)
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

# ─── Validation mots de passe ────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ─── Internationalisation ─────────────────────────────────────────
LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Porto-Novo"
USE_I18N = True
USE_TZ = True

# ─── Fichiers statiques et média ─────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = config("MEDIA_ROOT", default=str(BASE_DIR / "media"))

# Stockage des fichiers envoyés : « local » (disque du serveur, production) ou
# « cloudinary » (pré-production sur Render, sans disque persistant).
# Voir apps.common.storage.
MEDIA_STORAGE = config("MEDIA_STORAGE", default="local")
STORAGES = {
    "default": {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage"
        if MEDIA_STORAGE == "cloudinary" else "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
# Identifiants Cloudinary (MEDIA_STORAGE=cloudinary uniquement).
CLOUDINARY_STORAGE = {
    "CLOUD_NAME": config("CLOUDINARY_CLOUD_NAME", default=""),
    "API_KEY": config("CLOUDINARY_API_KEY", default=""),
    "API_SECRET": config("CLOUDINARY_API_SECRET", default=""),
}

# Documents sensibles (CV, preuves de paiement, justificatifs) en mode local :
# hors de MEDIA_ROOT, jamais servis directement — uniquement par lien signé.
PRIVATE_MEDIA_ROOT = config("PRIVATE_MEDIA_ROOT", default=str(BASE_DIR / "private_media"))
PRIVATE_MEDIA_URL_MAX_AGE = config("PRIVATE_MEDIA_URL_MAX_AGE", default=60 * 60 * 12, cast=int)  # 12 h
# Avec nginx : préfixe d'un emplacement « internal » pointant sur PRIVATE_MEDIA_ROOT
# (ex. /protected/) — nginx envoie alors le fichier lui-même (X-Accel-Redirect).
PRIVATE_MEDIA_ACCEL_REDIRECT = config("PRIVATE_MEDIA_ACCEL_REDIRECT", default="")

# ─── REST Framework ──────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    "EXCEPTION_HANDLER": "apps.common.exceptions.custom_exception_handler",
    # Limites de débit (par IP pour les anonymes, par compte sinon). Les vues
    # sensibles ont en plus leur propre quota (throttle_scope).
    "DEFAULT_THROTTLE_CLASSES": (
        "apps.common.throttling.ClientAnonRateThrottle",
        "apps.common.throttling.ClientUserRateThrottle",
        "apps.common.throttling.ClientScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "300/min",
        "user": "600/min",
        "login": "10/min",              # force brute sur les mots de passe
        "password_reset": "5/hour",     # emails de réinitialisation
        "candidature": "5/hour",        # formulaire d'adhésion public
        "event_register": "20/hour",    # inscription publique aux événements
        "participant_lookup": "60/hour",  # pré-remplissage (aspiration de données)
        "comment": "30/hour",
        "declaration": "20/hour",
        "member_email": "30/hour",      # emails de l'administration aux membres
    },
    # Derrière le proxy de Render : l'IP du client est lue dans X-Forwarded-For
    # (sinon tout le monde partagerait l'IP du proxy). Surchargé en prod.
    "NUM_PROXIES": None,
}

# En-tête portant l'IP réelle du visiteur, posé par un proxy de confiance (voir
# apps.common.throttling.ClientIPMixin). Aucun par défaut.
CLIENT_IP_HEADER = config("CLIENT_IP_HEADER", default="") or None

# Lien de réinitialisation du mot de passe : valable 24 h, usage unique.
PASSWORD_RESET_TIMEOUT = 60 * 60 * 24

# Taille maximale d'une requête (fichiers compris) — voir MaxRequestSizeMiddleware.
MAX_REQUEST_BYTES = 20 * 1024 * 1024

# ─── JWT ─────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=config("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=60, cast=int)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=config("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=30, cast=int)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
}

# ─── CORS ────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", default="http://localhost:3000", cast=Csv())
CORS_ALLOW_CREDENTIALS = True

# ─── API Documentation (drf-spectacular) ─────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "Data Afrique Hub API",
    "DESCRIPTION": "API REST pour la plateforme de gestion de la communauté Data Afrique Hub.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# ─── Celery ──────────────────────────────────────────────────────
CELERY_BROKER_URL = config("REDIS_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = config("REDIS_URL", default="redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# ─── Email ───────────────────────────────────────────────────────
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:3000")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="noreply@dataafriquehub.com")
EMAIL_HOST = config("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = True
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
# Sans timeout, une connexion SMTP lente bloque la requête indéfiniment (les emails
# sont envoyés de façon synchrone, CELERY_TASK_ALWAYS_EAGER=True) jusqu'à ce que
# Gunicorn tue le worker — d'où un ERR_CONNECTION_RESET côté client.
EMAIL_TIMEOUT = config("EMAIL_TIMEOUT", default=10, cast=int)

# Clé API Brevo (Settings → SMTP & API → API Keys — différente de la clé SMTP) :
# utilisée par apps.common.email.send_transactional_email, qui passe par l'API HTTP
# de Brevo au lieu du SMTP brut (port 587), peu fiable en sortie depuis Render.
BREVO_API_KEY = config("BREVO_API_KEY", default="")

# Pré-production : tous les emails sont détournés vers ces adresses (séparées par
# des virgules), avec le vrai destinataire dans l'objet — jamais vers les membres.
EMAIL_REDIRECT_TO = [a.strip() for a in config("EMAIL_REDIRECT_TO", default="").split(",") if a.strip()]
# false : aucun email envoyé (seulement journalisé).
EMAIL_ENABLED = config("EMAIL_ENABLED", default=True, cast=bool)
# Emails des comptes de démo (@dah.com, adresses fictives) détournés vers ces
# adresses (séparées par des virgules) ; vide = ignorés. Utile en pré-production.
DEMO_EMAIL_REDIRECT_TO = [a.strip() for a in config("DEMO_EMAIL_REDIRECT_TO", default="").split(",") if a.strip()]
# Quota quotidien d'emails de l'hébergeur d'envoi (Brevo gratuit : 300 / jour),
# partagé par tous les envois — vérifié avant un email aux membres.
EMAIL_DAILY_QUOTA = config("EMAIL_DAILY_QUOTA", default=300, cast=int)

# Membres du bureau sur le site public (annuaire, profils) : masqués pour l'instant.
PUBLIC_SHOW_BUREAU = config("PUBLIC_SHOW_BUREAU", default=False, cast=bool)

# ─── Sécurité headers ────────────────────────────────────────────
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# ─── Logging ─────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "apps": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
    },
}
