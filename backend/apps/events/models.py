import uuid
from django.conf import settings
from django.db import models
from apps.common.mixins import TimestampMixin


EVENT_TYPE_CHOICES = [
    ("webinaire", "Webinaire"),
    ("conference", "Conférence"),
    ("atelier", "Atelier"),
    ("hackathon", "Hackathon"),
    ("meetup", "Meetup"),
    ("formation", "Formation"),
    ("autre", "Autre"),
]


class Event(TimestampMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=300, verbose_name="Titre")
    description = models.TextField(verbose_name="Description")
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES, verbose_name="Type")
    cover_image = models.ImageField(upload_to="events/covers/", null=True, blank=True)
    recap_image = models.ImageField(
        upload_to="events/recap/", null=True, blank=True, verbose_name="Image récapitulative"
    )
    start_date = models.DateTimeField(verbose_name="Date de début")
    end_date = models.DateTimeField(null=True, blank=True, verbose_name="Date de fin")
    registration_deadline = models.DateTimeField(null=True, blank=True, verbose_name="Clôture des inscriptions")
    location = models.CharField(max_length=300, blank=True, verbose_name="Lieu")
    online_link = models.URLField(blank=True, verbose_name="Lien de connexion")
    max_participants = models.PositiveIntegerField(null=True, blank=True, verbose_name="Participants max")
    is_published = models.BooleanField(default=False, verbose_name="Publié")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name="created_events",
    )
    qr_code = models.ImageField(upload_to="events/qrcodes/", null=True, blank=True)

    class Meta:
        ordering = ["-start_date"]
        verbose_name = "Événement"
        verbose_name_plural = "Événements"

    def __str__(self):
        return self.title

    @property
    def is_full(self):
        if self.max_participants is None:
            return False
        return self.participants.count() >= self.max_participants

    @property
    def participant_count(self):
        return self.participants.count()


class EventParticipant(TimestampMixin):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="event_participations",
    )
    email = models.EmailField()
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    nationality = models.CharField(max_length=100)
    organisation = models.CharField(max_length=200)
    profession = models.CharField(max_length=150)
    attended_at = models.DateTimeField(null=True, blank=True)
    presence_validated = models.BooleanField(default=False)
    motivation = models.TextField()

    class Meta:
        unique_together = [("event", "email")]
        verbose_name = "Participant"
        verbose_name_plural = "Participants"

    def __str__(self):
        return f"{self.email} → {self.event.title}"


class EventSpeaker(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="speakers")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="speaking_at",
    )
    name = models.CharField(max_length=200)
    bio = models.TextField(blank=True)
    photo = models.ImageField(upload_to="events/speakers/", null=True, blank=True)

    def __str__(self):
        return self.name


class EventReminder(models.Model):
    """Rappel envoyé par le bureau aux inscrits d'un événement (historique)."""

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="reminders")
    subject = models.CharField(max_length=150)
    message = models.TextField()
    sent_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    sent_at = models.DateTimeField(auto_now_add=True)
    recipients = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-sent_at"]
        verbose_name = "Rappel d'événement"
        verbose_name_plural = "Rappels d'événements"

    def __str__(self):
        return f"{self.event.title} — {self.sent_at:%d/%m/%Y} ({self.recipients})"
