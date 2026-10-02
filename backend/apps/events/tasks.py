from celery import shared_task
from django.conf import settings

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
        preheader=f"Rendez-vous le {event.start_date:%d/%m/%Y à %H:%M}.",
        title="Votre inscription est confirmée",
        greeting=f"Bonjour {participant.first_name},",
        paragraphs=[f"Votre inscription à l'évènement « {event.title} » est confirmée."],
        details=[
            ("Date", f"{event.start_date:%d/%m/%Y à %H:%M}"),
            ("Lieu", event.location),
            ("Lien de connexion", event.online_link),
        ],
        cta=("Voir l'évènement", f"{settings.FRONTEND_URL}/events/{event.pk}"),
    )
