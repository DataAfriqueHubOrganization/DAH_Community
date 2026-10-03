from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.common.mixins import TimestampMixin


class PointEntry(TimestampMixin):
    """Registre des points : chaque attribution est une ligne datée et motivée.

    Une tâche (de département ou de projet) et un point d'étape ne rapportent des
    points qu'une seule fois — garanti par les contraintes d'unicité ci-dessous,
    même si la tâche est renvoyée puis revalidée. Le classement d'une période
    additionne les lignes dont awarded_at tombe dans la période."""

    SOURCE_TASK = "task"
    SOURCE_CHECKIN = "checkin"
    SOURCE_ADJUSTMENT = "adjustment"
    SOURCE_CHOICES = [
        (SOURCE_TASK, "Tâche validée"),
        (SOURCE_CHECKIN, "Point d'étape"),
        (SOURCE_ADJUSTMENT, "Ajustement"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="point_entries")
    points = models.IntegerField()
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    # Département de rattachement : périmètre du classement d'un responsable.
    department = models.ForeignKey(
        "departments.Department", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    department_task = models.ForeignKey(
        "departments.DepartmentTask", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    project_task = models.ForeignKey(
        "projects.ProjectTask", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    checkin = models.ForeignKey(
        "engagement.CheckIn", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    # Libellé figé à l'attribution (le titre de la tâche peut changer ou disparaître).
    label = models.CharField(max_length=300)
    # Tâche avec échéance : soumise à temps ? (None = pas d'échéance / pas une tâche)
    on_time = models.BooleanField(null=True, blank=True)
    reason = models.TextField(blank=True, verbose_name="Motif (ajustement)")
    awarded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    awarded_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        verbose_name = "Attribution de points"
        verbose_name_plural = "Registre des points"
        ordering = ["-awarded_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["department_task"], condition=Q(department_task__isnull=False),
                name="points_once_per_department_task",
            ),
            models.UniqueConstraint(
                fields=["project_task"], condition=Q(project_task__isnull=False),
                name="points_once_per_project_task",
            ),
            models.UniqueConstraint(
                fields=["checkin"], condition=Q(checkin__isnull=False),
                name="points_once_per_checkin",
            ),
        ]

    def __str__(self):
        return f"{self.user} {self.points:+d} — {self.label}"


class CheckIn(TimestampMixin):
    """« Point d'étape » : le responsable le lance, le membre propose des scores
    sur son implication et répond à deux questions ouvertes, le responsable
    confirme ou ajuste chaque score et écrit un retour. Seuls les scores finaux
    du responsable comptent ; le membre ne voit que le retour écrit."""

    STATUS_PENDING = "pending"
    STATUS_SUBMITTED = "submitted"
    STATUS_CONFIRMED = "confirmed"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "À remplir"),
        (STATUS_SUBMITTED, "À confirmer"),
        (STATUS_CONFIRMED, "Confirmé"),
        (STATUS_CANCELLED, "Annulé"),
    ]

    # Critères notés de 1 à 5 (même grille pour le membre et le responsable).
    CRITERIA = [
        ("participation", "Participation à la vie du département"),
        ("follow_up", "Suivi des tâches et respect des délais"),
        ("quality", "Qualité des contributions"),
        ("teamwork", "Esprit d'équipe et entraide"),
        ("initiative", "Prise d'initiative"),
    ]
    MAX_POINTS = 20

    department = models.ForeignKey("departments.Department", on_delete=models.CASCADE, related_name="checkins")
    member = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="checkins")
    launched_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+",
    )
    period_label = models.CharField(max_length=100, verbose_name="Période")
    due_date = models.DateField(null=True, blank=True, verbose_name="À remplir avant le")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)

    # Réponses du membre
    self_scores = models.JSONField(default=dict, blank=True)
    improve_self = models.TextField(blank=True, verbose_name="Ce que je peux améliorer")
    department_help = models.TextField(blank=True, verbose_name="Ce que le département peut faire")
    remark = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    # Décision du responsable
    final_scores = models.JSONField(default=dict, blank=True)
    feedback = models.TextField(blank=True, verbose_name="Retour du responsable")
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    points = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        verbose_name = "Point d'étape"
        verbose_name_plural = "Points d'étape"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.member} — {self.period_label} ({self.get_status_display()})"


class Award(TimestampMixin):
    """Distinction « Membre du mois » / « Membre de l'année », désignée par le
    bureau à partir du classement de la communauté."""

    KIND_MONTH = "month"
    KIND_YEAR = "year"
    KIND_CHOICES = [(KIND_MONTH, "Membre du mois"), (KIND_YEAR, "Membre de l'année")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="awards")
    kind = models.CharField(max_length=10, choices=KIND_CHOICES)
    # 1er jour de la période (1er du mois, ou 1er janvier).
    period_start = models.DateField()
    note = models.TextField(blank=True)
    awarded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+",
    )

    class Meta:
        verbose_name = "Distinction"
        verbose_name_plural = "Distinctions"
        ordering = ["-period_start"]
        constraints = [
            models.UniqueConstraint(fields=["kind", "period_start"], name="one_award_per_period"),
        ]

    def __str__(self):
        return f"{self.get_kind_display()} {self.period_start:%m/%Y} — {self.user}"
