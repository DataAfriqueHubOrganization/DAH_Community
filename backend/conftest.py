import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """Les quotas (throttling) sont stockés dans le cache : on repart à zéro à
    chaque test pour qu'ils ne débordent pas d'un test sur l'autre."""
    cache.clear()
    yield


@pytest.fixture(autouse=True)
def _isolated_media(settings, tmp_path):
    """Fichiers envoyés pendant les tests : dossiers temporaires, jamais ceux du projet."""
    settings.MEDIA_ROOT = str(tmp_path / "media")
    settings.PRIVATE_MEDIA_ROOT = str(tmp_path / "private_media")
    settings.PRIVATE_MEDIA_ACCEL_REDIRECT = ""
    return tmp_path
