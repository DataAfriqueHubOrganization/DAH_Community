from django.conf import settings
from django.db import models
from apps.common.mixins import ReviewableTaskMixin, TimestampMixin


class Project(TimestampMixin):
    STATUS_CHOICES = [
        ("idea", "Idée"),
        ("active", "En cours"),
        ("paused", "Pausé"),
        ("completed", "Terminé"),
        ("archived", "Archivé"),
    ]

    title = models.CharField(max_length=300)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="idea")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="owned_projects")
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="projects")
    department = models.ForeignKey("departments.Department", null=True, blank=True, on_delete=models.SET_NULL)
    deadline = models.DateField(null=True, blank=True)
    repository_url = models.URLField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class ProjectTask(ReviewableTaskMixin, TimestampMixin):
    STATUS_CHOICES = [
        ("todo", "À faire"),
        ("in_progress", "En cours"),
        ("submitted", "À valider"),
        ("done", "Validée"),
        ("blocked", "Bloquée"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="todo")

    class Meta:
        ordering = ["due_date", "created_at"]
