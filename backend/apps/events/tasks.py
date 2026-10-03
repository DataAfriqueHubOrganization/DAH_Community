from celery import shared_task
from django.conf import settings
from django.utils import timezone

from apps.common.email import send_branded_email


@shared_task(bind=True, max_retries=3)
def send_event_registration_confirmation(self, participant_pk: int):
    from .models import EventParticipant

    try:
        participant = EventParticipant.objects.select_related("event").get(pk=participant_pk)
    except EventParticipant.DoesNotExist:
        return

    event = participant.event
    send_branded_email(
        subject=f"Confirmation d'inscription — {event.title}",
        recipient_list=[participant.email],
        preheader=f"Rendez-vous le {timezone.localtime(event.start_date):%d/%m/%Y à %H:%M}.",
        title="Votre inscription est confirmée",
        greeting=f"Bonjour {participant.first_name},",
        paragraphs=[f"Votre inscription à l'évènement « {event.title} » est confirmée."],
        details=[
            ("Date", f"{timezone.localtime(event.start_date):%d/%m/%Y à %H:%M}"),
            ("Lieu", event.location),
            ("Lien de connexion", event.online_link),
        ],
        cta=("Voir l'évènement", f"{settings.FRONTEND_URL}/events/{event.pk}"),
    )


def send_event_reminder_email(event, *, email: str, first_name: str, subject: str, message: str):
    """Rappel du bureau : message libre + informations pratiques de l'événement."""
    start = timezone.localtime(event.start_date)
    paragraphs = [p.strip() for p in message.replace("\r\n", "\n").split("\n\n") if p.strip()]
    send_branded_email(
        subject=subject,
        recipient_list=[email],
        preheader=paragraphs[0][:120] if paragraphs else event.title,
        title=event.title,
        greeting=f"Bonjour {first_name}," if first_name else "Bonjour,",
        paragraphs=paragraphs,
        details_title="Informations pratiques",
        details=[
            ("Date", f"{start:%d/%m/%Y à %H:%M}"),
            ("Lieu", event.location),
            ("Lien de connexion", event.online_link),
        ],
        cta=("Voir l'évènement", f"{settings.FRONTEND_URL}/events/{event.pk}"),
    )
