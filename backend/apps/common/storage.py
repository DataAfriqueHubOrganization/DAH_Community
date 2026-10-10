"""Stockage des fichiers envoyés : disque du serveur ou Cloudinary.

MEDIA_STORAGE :
  * « local » — disque du serveur (production sur Contabo) : MEDIA_ROOT pour les
    fichiers publics, PRIVATE_MEDIA_ROOT pour les documents sensibles ;
  * « cloudinary » — pour un hébergeur sans disque persistant (pré-production
    sur Render). Réglé dans le tableau de bord de Render (voir deploy/PREPROD.md).

Deux familles :
  * publics (avatars, couvertures…) : stockage par défaut (STORAGES["default"]) ;
  * privés (CV, preuves de paiement, justificatifs) : private_storage() /
    private_image_storage(). En local, jamais servis directement : l'URL est un
    lien signé à durée limitée (vue apps.common.views.private_file), produit
    uniquement dans les réponses de l'API déjà réservées aux bonnes personnes.
    Chez Cloudinary, l'URL est celle du fichier (adaptée à la pré-production,
    qui ne contient que des données de démonstration).
"""
import os

from django.conf import settings
from django.core import signing
from django.core.files.storage import FileSystemStorage, Storage
from django.urls import reverse
from django.utils.deconstruct import deconstructible

LOCAL = "local"
CLOUDINARY = "cloudinary"
_PRIVATE_SALT = "dah-private-media"


def media_backend() -> str:
    return getattr(settings, "MEDIA_STORAGE", LOCAL)


@deconstructible
class PrivateFileSystemStorage(FileSystemStorage):
    """Dossier privé du serveur ; URL = lien signé et expirant."""

    def __init__(self, **kwargs):
        kwargs.setdefault("base_url", None)
        super().__init__(**kwargs)

    # Dossier lu dans les réglages à chaque accès (et non figé au démarrage).
    @property
    def base_location(self):
        return self._value_or_setting(self._location, settings.PRIVATE_MEDIA_ROOT)

    @property
    def location(self):
        return os.path.abspath(self.base_location)

    def url(self, name):
        token = signing.dumps(name, salt=_PRIVATE_SALT)
        return f"{reverse('private-file')}?t={token}"


def read_private_token(token: str) -> str:
    """Nom du fichier désigné par un lien signé (ValueError s'il est faux ou expiré)."""
    try:
        return signing.loads(token, salt=_PRIVATE_SALT, max_age=settings.PRIVATE_MEDIA_URL_MAX_AGE)
    except signing.BadSignature as exc:  # SignatureExpired en hérite
        raise ValueError("Lien invalide ou expiré.") from exc


def private_storage() -> Storage:
    """Documents sensibles (PDF ou images) : CV de candidature, justificatifs de caisse."""
    if media_backend() == CLOUDINARY:
        from cloudinary_storage.storage import RawMediaCloudinaryStorage  # fichiers « bruts » (PDF…)
        return RawMediaCloudinaryStorage()
    return PrivateFileSystemStorage()


def private_image_storage() -> Storage:
    """Documents sensibles rangés en « image » chez Cloudinary (preuves de paiement,
    CV du profil — type historique, conservé pour que les liens existants restent valides)."""
    if media_backend() == CLOUDINARY:
        from cloudinary_storage.storage import MediaCloudinaryStorage
        return MediaCloudinaryStorage()
    return PrivateFileSystemStorage()
