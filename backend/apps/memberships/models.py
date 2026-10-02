from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.core.validators import FileExtensionValidator
from django.db import models
from apps.common.mixins import TimestampMixin


def _cv_storage():
    """Le CV est un PDF (fichier "raw" pour Cloudinary, pas une image) : il a besoin
    d'un backend dédié, différent du STORAGES["default"] utilisé pour les images
    (avatars...). En dev, on reste sur le disque local (pas de credentials Cloudinary
    nécessaires pour développer)."""
    if settings.DEBUG:
        return FileSystemStorage()
    from cloudinary_storage.storage import RawMediaCloudinaryStorage
    return RawMediaCloudinaryStorage()


class Candidature(TimestampMixin):
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_REJECTED = "rejected"

    STATUS_CHOICES = [
        (STATUS_PENDING, "En attente"),
        (STATUS_ACCEPTED, "Acceptée"),
        (STATUS_REJECTED, "Rejetée"),
    ]

    # Ce que la personne attend de la communauté (plusieurs choix possibles).
    ENGAGEMENT_VOLUNTEER = "volunteer"
    ENGAGEMENT_CHOICES = [
        (ENGAGEMENT_VOLUNTEER, "M'engager comme bénévole dans un pôle"),
        ("training", "Me former et monter en compétences"),
        ("expertise", "Partager mon expertise (intervention, mentorat)"),
        ("news", "Rester informé·e de la vie de la communauté"),
    ]
    # Pôles de DAH (sous-entités de la charte graphique) — pour le bénévolat.
    POLE_CHOICES = [
        ("data_tour", "Data Tour"),
        ("academy", "DAH Academy"),
        ("media", "DAH Média"),
        ("labs", "DAH Labs"),
    ]

    first_name = models.CharField(max_length=100, verbose_name="Prénom")
    last_name = models.CharField(max_length=100, verbose_name="Nom")
    email = models.EmailField(unique=True, verbose_name="Email")
    phone = models.CharField(max_length=20, blank=True, verbose_name="Téléphone")
    country = models.CharField(max_length=100, verbose_name="Pays")
    profession = models.CharField(max_length=150, verbose_name="Profession")
    linkedin_url = models.URLField(blank=True, verbose_name="LinkedIn")
    motivation = models.TextField(verbose_name="Motivation")
    # Listes de clés de ENGAGEMENT_CHOICES / POLE_CHOICES. JSONField plutôt
    # qu'ArrayField : portable et suffisant pour quelques valeurs. Vides pour les
    # candidatures antérieures à ces champs.
    engagements = models.JSONField(default=list, blank=True, verbose_name="Souhaits d'engagement")
    volunteer_poles = models.JSONField(default=list, blank=True, verbose_name="Pôles (bénévolat)")
    cv = models.FileField(
        upload_to="candidatures_cv/", null=True, blank=True,
        storage=_cv_storage,
        validators=[FileExtensionValidator(["pdf"])],
        verbose_name="CV",
    )

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING,
        verbose_name="Statut",
    )
    rejection_reason = models.TextField(blank=True, verbose_name="Motif de refus")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="reviewed_candidatures",
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="candidature",
    )

    class Meta:
        verbose_name = "Candidature"
        verbose_name_plural = "Candidatures"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.full_name} <{self.email}> — {self.get_status_display()}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def get_engagements_display(self) -> list[str]:
        labels = dict(self.ENGAGEMENT_CHOICES)
        return [labels.get(key, key) for key in self.engagements]

    def get_volunteer_poles_display(self) -> list[str]:
        labels = dict(self.POLE_CHOICES)
        return [labels.get(key, key) for key in self.volunteer_poles]
