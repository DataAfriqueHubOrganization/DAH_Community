"""Quota quotidien d'emails (Brevo, plan gratuit : 300 / jour, tous envois confondus)."""
import logging

from django.conf import settings
from django.db.models import F
from django.utils import timezone

logger = logging.getLogger(__name__)


def daily_limit() -> int:
    return getattr(settings, "EMAIL_DAILY_QUOTA", 300)


def sent_today() -> int:
    from .models import DailyEmailCount

    row = DailyEmailCount.objects.filter(day=timezone.localdate()).first()
    return row.count if row else 0


def remaining_today() -> int:
    return max(daily_limit() - sent_today(), 0)


def record_sent(n: int = 1) -> None:
    """Compte n emails envoyés aujourd'hui. Ne bloque jamais un envoi."""
    from .models import DailyEmailCount

    try:
        today = timezone.localdate()
        DailyEmailCount.objects.get_or_create(day=today)
        DailyEmailCount.objects.filter(day=today).update(count=F("count") + n)
    except Exception:  # noqa: BLE001 — un compteur en panne ne doit pas casser l'envoi
        logger.exception("Compteur d'emails du jour indisponible")
