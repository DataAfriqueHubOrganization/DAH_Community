import pytest
from django.core import mail
from django.core.management import call_command

from apps.engagement.models import Award, CheckIn, PointEntry
from apps.engagement.services import build_ranking, period_bounds
from apps.projects.models import ProjectTask


@pytest.fixture
def no_side_effects(monkeypatch, settings):
    calls = []
    monkeypatch.setattr("apps.common.background.fire_and_forget", lambda *a, **k: calls.append(a))
    monkeypatch.setattr("apps.engagement.services.fire_and_forget", lambda *a, **k: calls.append(a))
    monkeypatch.setattr("apps.departments.services.fire_and_forget", lambda *a, **k: calls.append(a))
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    return calls


@pytest.mark.django_db
def test_seed_engagement_complet_sans_email_et_idempotent(no_side_effects):
    call_command("seed_engagement")

    task_points = PointEntry.objects.filter(source="task").count()
    assert task_points >= 60  # ~6 mois d'historique pour 12 membres
    assert PointEntry.objects.filter(source="checkin").count() > 0
    assert ProjectTask.objects.filter(status="submitted").exists()  # à valider en direct
    assert ProjectTask.objects.exclude(return_reason="").exists()   # tâche renvoyée
    assert CheckIn.objects.filter(status="pending").exists()
    assert CheckIn.objects.filter(status="submitted").exists()
    assert Award.objects.filter(kind="month").count() >= 2
    # Classement de l'année varié (pas d'égalité générale)
    from django.utils import timezone
    rows = build_ranking(*period_bounds("year", timezone.localdate()))
    assert len({r["total"] for r in rows}) > 5

    # Aucun email : ni envoyé, ni programmé en tâche de fond
    assert mail.outbox == []
    assert no_side_effects == []

    # Relancer ne crée rien de plus
    counts = (PointEntry.objects.count(), ProjectTask.objects.count(), CheckIn.objects.count(), Award.objects.count())
    call_command("seed_engagement")
    assert counts == (PointEntry.objects.count(), ProjectTask.objects.count(), CheckIn.objects.count(), Award.objects.count())
