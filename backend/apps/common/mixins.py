from django.db import models


class TimestampMixin(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ReviewableTaskMixin(models.Model):
    """Cycle de validation commun aux tâches de département et de projet :
    À faire → En cours → À valider (soumise par l'assigné) → Validée (par le
    responsable), ou renvoyée en cours avec un motif. Les points ne sont
    accordés qu'à la validation (voir apps.engagement.services)."""

    STATUS_SUBMITTED = "submitted"
    STATUS_DONE = "done"
    # Statuts qu'un assigné ou un responsable peut choisir librement ; « À valider »
    # et « Validée » ne s'obtiennent que par les actions submit / validate.
    FREE_STATUSES = ("todo", "in_progress", "blocked")

    SIZE_CHOICES = [
        ("small", "Petite"),
        ("medium", "Moyenne"),
        ("large", "Grande"),
    ]

    size = models.CharField(max_length=10, choices=SIZE_CHOICES, default="medium", verbose_name="Envergure")
    submitted_at = models.DateTimeField(null=True, blank=True, verbose_name="Soumise le")
    submission_note = models.TextField(blank=True, verbose_name="Note de soumission")
    return_reason = models.TextField(blank=True, verbose_name="Motif du renvoi")
    validated_at = models.DateTimeField(null=True, blank=True, verbose_name="Validée le")
    validated_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    is_outstanding = models.BooleanField(default=False, verbose_name="Travail remarquable")
    points_awarded = models.PositiveIntegerField(null=True, blank=True, verbose_name="Points accordés")

    class Meta:
        abstract = True
