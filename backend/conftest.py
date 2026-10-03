import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """Les quotas (throttling) sont stockés dans le cache : on repart à zéro à
    chaque test pour qu'ils ne débordent pas d'un test sur l'autre."""
    cache.clear()
    yield
