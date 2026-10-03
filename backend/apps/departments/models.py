from django.conf import settings
from django.db import models
from apps.common.mixins import ReviewableTaskMixin, TimestampMixin


class Department(TimestampMixin):
    name = models.CharField(max_length=200, unique=True, verbose_name="Nom")
    description = models.TextField(blank=True)
    lead = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="led_departments",
        verbose_name="Responsable",
    )
    co_lead = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="co_led_departments",
        verbose_name="Co-responsable",
    )

    class Meta:
        verbose_name = "Département"
        ordering = ["name"]

    def __str__(self):
        return self.name


class DepartmentMembership(TimestampMixin):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="department_memberships",
    )
    start_date = models.DateField(verbose_name="Depuis le")
    end_date = models.DateField(null=True, blank=True, verbose_name="Jusqu'au")

    class Meta:
        verbose_name = "Adhésion à un département"
        verbose_name_plural = "Adhésions à un département"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.user.full_name} → {self.department.name}"


class DepartmentAnnouncement(TimestampMixin):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="announcements")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    title = models.CharField(max_length=300)
    content = models.TextField()

    class Meta:
        ordering = ["-created_at"]


class DepartmentSession(TimestampMixin):
    FREQUENCY_CHOICES = [
        ("none", "Unique"),
        ("weekly", "Hebdomadaire"),
        ("biweekly", "Bihebdomadaire"),
        ("monthly", "Mensuelle"),
    ]

    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="sessions")
    date = models.DateField(verbose_name="Date de la séance")
    theme = models.CharField(max_length=300, blank=True, verbose_name="Thème")
    meet_link = models.URLField(blank=True, verbose_name="Lien de la réunion")
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default="none", verbose_name="Fréquence")
    series_id = models.UUIDField(null=True, blank=True, db_index=True, verbose_name="Série")
    report = models.TextField(blank=True, verbose_name="Compte-rendu")
    present_members = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="attended_department_sessions",
        verbose_name="Présents",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+",
    )

    class Meta:
        verbose_name = "Séance de département"
        verbose_name_plural = "Séances de département"
        ordering = ["-date"]

    def __str__(self):
        return f"{self.department.name} — {self.date}"


class DepartmentTask(ReviewableTaskMixin, TimestampMixin):
    STATUS_CHOICES = [
        ("todo", "À faire"),
        ("in_progress", "En cours"),
        ("submitted", "À valider"),
        ("done", "Validée"),
        ("blocked", "Bloquée"),
    ]

    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="department_tasks",
    )
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="todo")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+",
    )

    class Meta:
        verbose_name = "Tâche de département"
        verbose_name_plural = "Tâches de département"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
