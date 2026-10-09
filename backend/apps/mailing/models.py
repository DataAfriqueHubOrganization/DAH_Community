from django.conf import settings
from django.db import models


class AUDIENCES:
    SELECTION = "selection"
    ALL = "all"
    BUREAU = "bureau"
    LEADS = "leads"
    DEPARTMENT = "department"

    CHOICES = [
        (SELECTION, "Membres choisis"),
        (ALL, "Tous les membres actifs"),
        (BUREAU, "Bureau"),
        (LEADS, "Responsables de département"),
        (DEPARTMENT, "Un département"),
    ]


class MemberEmail(models.Model):
    """Email envoyé par l'administration à un ou plusieurs membres (historique)."""

    subject = models.CharField(max_length=150, verbose_name="Objet")
    body = models.TextField(verbose_name="Message (HTML nettoyé)")
    template = models.CharField(max_length=30, blank=True, verbose_name="Modèle")
    cta_label = models.CharField(max_length=60, blank=True, verbose_name="Texte du bouton")
    cta_url = models.URLField(blank=True, verbose_name="Lien du bouton")
    audience = models.CharField(max_length=20, choices=AUDIENCES.CHOICES, verbose_name="Destinataires")
    audience_label = models.CharField(max_length=200, blank=True)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+", verbose_name="Envoyé par",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Envoyé le")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Email aux membres"
        verbose_name_plural = "Emails aux membres"

    def __str__(self):
        return f"{self.subject} ({self.created_at:%d/%m/%Y})"


class MemberEmailRecipient(models.Model):
    class STATUS:
        PENDING = "pending"
        SENT = "sent"
        FAILED = "failed"
        CHOICES = [(PENDING, "En attente"), (SENT, "Envoyé"), (FAILED, "Échec")]

    email = models.ForeignKey(MemberEmail, on_delete=models.CASCADE, related_name="recipients")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    address = models.EmailField()
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=10, choices=STATUS.CHOICES, default=STATUS.PENDING)
    error = models.CharField(max_length=255, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        verbose_name = "Destinataire"

    def __str__(self):
        return f"{self.address} — {self.get_status_display()}"


class DailyEmailCount(models.Model):
    """Emails envoyés par la plateforme, par jour (tous types confondus) : le quota
    quotidien de Brevo est partagé entre les envois automatiques et les messages."""

    day = models.DateField(unique=True)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Compteur d'emails du jour"

    def __str__(self):
        return f"{self.day} : {self.count}"
