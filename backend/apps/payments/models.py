import uuid
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.core.validators import FileExtensionValidator
from django.db import models
from apps.common.mixins import TimestampMixin


PAYMENT_STATUS_CHOICES = [
    ("pending", "En attente"),
    ("completed", "Complété"),
    ("failed", "Échoué"),
    ("refunded", "Remboursé"),
]

PROVIDER_CHOICES = [
    ("cinetpay", "CinetPay"),
    ("stripe", "Stripe"),
    ("manual", "Manuel"),
    ("mobile_money", "Mobile Money"),
]


class Payment(TimestampMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="XOF")
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default="pending")
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default="manual")
    provider_reference = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    year = models.PositiveIntegerField(help_text="Année de cotisation")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Paiement"

    def __str__(self):
        return f"{self.user.full_name} — {self.amount} {self.currency} ({self.year})"


# ── Cotisations mensuelles et caisse ─────────────────────────────────────────

def _attachment_storage():
    """Justificatifs (PDF ou photo) : stockage « raw » Cloudinary en prod, comme
    les CV — le disque de Render n'est pas conservé entre deux déploiements."""
    if settings.DEBUG:
        return FileSystemStorage()
    from cloudinary_storage.storage import RawMediaCloudinaryStorage
    return RawMediaCloudinaryStorage()


class Contribution(TimestampMixin):
    """Un paiement de cotisation enregistré par le trésorier (ou l'admin).

    Il couvre `months` mois consécutifs à partir de `period_start` ; chaque mois
    couvert a sa ligne ContributionMonth (unique par membre et par mois : un mois
    ne se paie qu'une fois) et rapporte des points au membre dans ce mois-là."""

    METHOD_CASH = "cash"
    METHOD_MOBILE_MONEY = "mobile_money"
    METHOD_TRANSFER = "transfer"
    METHOD_OTHER = "other"
    METHOD_CHOICES = [
        (METHOD_CASH, "Espèces"),
        (METHOD_MOBILE_MONEY, "Mobile Money"),
        (METHOD_TRANSFER, "Virement"),
        (METHOD_OTHER, "Autre"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="contributions")
    period_start = models.DateField(verbose_name="Premier mois couvert")
    months = models.PositiveSmallIntegerField(verbose_name="Nombre de mois")
    monthly_rate = models.PositiveIntegerField(verbose_name="Tarif mensuel (FCFA)")
    amount = models.PositiveIntegerField(verbose_name="Montant (FCFA)")
    paid_on = models.DateField(verbose_name="Date du paiement")
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default=METHOD_CASH)
    reference = models.CharField(max_length=100, blank=True)
    note = models.CharField(max_length=300, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+",
    )

    class Meta:
        ordering = ["-paid_on", "-created_at"]
        verbose_name = "Cotisation"

    def __str__(self):
        return f"{self.user.full_name} — {self.amount} FCFA ({self.months} mois dès {self.period_start:%m/%Y})"


class ContributionMonth(models.Model):
    """Un mois de cotisation réglé (1er du mois)."""

    contribution = models.ForeignKey(Contribution, on_delete=models.CASCADE, related_name="covered_months")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    month = models.DateField()
    rate = models.PositiveIntegerField()

    class Meta:
        ordering = ["month"]
        constraints = [
            models.UniqueConstraint(fields=["user", "month"], name="contribution_once_per_month"),
        ]

    def __str__(self):
        return f"{self.user_id} {self.month:%m/%Y}"


class CashEntry(TimestampMixin):
    """Journal de caisse : recettes et dépenses de l'association. Les cotisations
    y figurent automatiquement (ligne liée, non modifiable depuis le journal)."""

    KIND_INCOME = "income"
    KIND_EXPENSE = "expense"
    KIND_CHOICES = [(KIND_INCOME, "Recette"), (KIND_EXPENSE, "Dépense")]

    CATEGORY_CONTRIBUTIONS = "contributions"
    INCOME_CATEGORIES = [
        (CATEGORY_CONTRIBUTIONS, "Cotisations"),
        ("donations", "Dons"),
        ("sponsorship", "Sponsoring"),
        ("events_income", "Événements (recettes)"),
        ("other_income", "Autre recette"),
    ]
    EXPENSE_CATEGORIES = [
        ("events", "Événements"),
        ("communication", "Communication"),
        ("tools", "Outils & abonnements"),
        ("logistics", "Logistique"),
        ("other_expense", "Autre dépense"),
    ]
    CATEGORY_CHOICES = INCOME_CATEGORIES + EXPENSE_CATEGORIES

    kind = models.CharField(max_length=10, choices=KIND_CHOICES)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    label = models.CharField(max_length=200)
    amount = models.PositiveIntegerField(verbose_name="Montant (FCFA)")
    date = models.DateField()
    method = models.CharField(max_length=20, choices=Contribution.METHOD_CHOICES, default=Contribution.METHOD_CASH)
    reference = models.CharField(max_length=100, blank=True)
    note = models.TextField(blank=True)
    attachment = models.FileField(
        upload_to="treasury/", null=True, blank=True, storage=_attachment_storage,
        validators=[FileExtensionValidator(["pdf", "jpg", "jpeg", "png", "webp"])],
        verbose_name="Justificatif",
    )
    contribution = models.OneToOneField(
        Contribution, on_delete=models.CASCADE, null=True, blank=True, related_name="cash_entry",
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+",
    )

    class Meta:
        ordering = ["-date", "-created_at"]
        verbose_name = "Écriture de caisse"
        verbose_name_plural = "Journal de caisse"

    def __str__(self):
        sign = "+" if self.kind == self.KIND_INCOME else "−"
        return f"{self.date} {sign}{self.amount} FCFA — {self.label}"

    @property
    def signed_amount(self) -> int:
        return self.amount if self.kind == self.KIND_INCOME else -self.amount


class PaymentDeclaration(TimestampMixin):
    """Le membre déclare avoir payé un ou plusieurs mois, avec une capture de la
    preuve de paiement ; le trésorier valide (le paiement est alors enregistré,
    avec ses points) ou refuse avec un motif."""

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "À valider"),
        (STATUS_APPROVED, "Validée"),
        (STATUS_REJECTED, "Refusée"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payment_declarations")
    period_start = models.DateField(verbose_name="Premier mois déclaré")
    months = models.PositiveSmallIntegerField(default=1)
    monthly_rate = models.PositiveIntegerField()
    amount = models.PositiveIntegerField()
    method = models.CharField(max_length=20, choices=Contribution.METHOD_CHOICES, default=Contribution.METHOD_MOBILE_MONEY)
    reference = models.CharField(max_length=100, blank=True)
    proof = models.ImageField(
        upload_to="payment_proofs/",
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"])],
        verbose_name="Preuve de paiement",
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    rejection_reason = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    contribution = models.OneToOneField(
        Contribution, on_delete=models.SET_NULL, null=True, blank=True, related_name="declaration",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Déclaration de paiement"
        verbose_name_plural = "Déclarations de paiement"

    def __str__(self):
        return f"{self.user.full_name} — {self.months} mois dès {self.period_start:%m/%Y} ({self.get_status_display()})"


class ContributionReminder(models.Model):
    """Rappel de cotisation envoyé par la trésorerie — un par mois au plus."""

    month = models.DateField(unique=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    sent_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    recipients = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-month"]
        verbose_name = "Rappel de cotisation"

    def __str__(self):
        return f"Rappel {self.month:%m/%Y} ({self.recipients} membres)"
