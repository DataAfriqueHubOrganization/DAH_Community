"""Stockage des fichiers envoyés, sur le disque du serveur.

Deux familles :
  * publics (avatars, couvertures d'événements et d'articles…) : MEDIA_ROOT,
    servis directement sous /media/ (par nginx en production) ;
  * privés (CV, preuves de paiement, justificatifs de caisse) : PRIVATE_MEDIA_ROOT,
    jamais servis directement. Leur URL est un lien signé à durée limitée (vue
    apps.common.views.private_file), produit uniquement dans les réponses de
    l'API déjà réservées aux personnes autorisées.
"""
import os

from django.conf import settings
from django.core import signing
from django.core.files.storage import FileSystemStorage
from django.urls import reverse
from django.utils.deconstruct import deconstructible

_PRIVATE_SALT = "dah-private-media"


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


def private_storage() -> PrivateFileSystemStorage:
    """Documents sensibles : CV, preuves de paiement, justificatifs."""
    return PrivateFileSystemStorage()
