import io
import logging
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.common.background import fire_and_forget
from .tasks import send_event_registration_confirmation

logger = logging.getLogger(__name__)


def register_participant(
    event, user, email: str, first_name: str, last_name: str,
    nationality: str, organisation: str, profession: str, motivation: str,
) -> "EventParticipant":
    from .models import EventParticipant

    with transaction.atomic():
        event_locked = type(event).objects.select_for_update().get(pk=event.pk)

        if event_locked.registration_deadline and timezone.now() > event_locked.registration_deadline:
            raise ValidationError("Les inscriptions sont closes pour cet événement.")

        if event_locked.is_full:
            raise ValidationError("Cet événement est complet.")

        participant, created = EventParticipant.objects.get_or_create(
            event=event_locked,
            email=email,
            defaults={
                "user": user,
                "first_name": first_name,
                "last_name": last_name,
                "nationality": nationality,
                "organisation": organisation,
                "profession": profession,
                "motivation": motivation,
            },
        )
        if not created:
            raise ValidationError("Vous êtes déjà inscrit à cet événement.")

        transaction.on_commit(
            lambda: fire_and_forget(
                send_event_registration_confirmation.delay, participant.pk,
                error_message=f"Impossible d'envoyer l'email de confirmation à {email}",
            )
        )

        logger.info("Inscription : %s → %s", email, event.title)
        return participant


def find_latest_participant_info(email: str) -> "EventParticipant | None":
    from .models import EventParticipant

    return (
        EventParticipant.objects.filter(email__iexact=email)
        .order_by("-created_at")
        .first()
    )


def validate_presence(participant) -> "EventParticipant":
    if participant.presence_validated:
        raise ValidationError("La présence a déjà été validée.")

    participant.presence_validated = True
    participant.attended_at = timezone.now()
    participant.save(update_fields=["presence_validated", "attended_at"])
    return participant


def generate_qr_code(event) -> None:
    import qrcode
    from django.core.files.base import ContentFile
    from django.conf import settings

    url = f"{settings.FRONTEND_URL}/events/{event.pk}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    event.qr_code.save(f"qr_{event.pk}.png", ContentFile(buffer.getvalue()), save=True)


def participants_queryset(*, date_from=None, date_to=None, event_ids=None):
    """Inscriptions de tous les événements, filtrées par période (date de
    l'événement, bornes incluses) et/ou par liste d'événements."""
    from .models import EventParticipant

    qs = EventParticipant.objects.select_related("event").order_by("-event__start_date", "last_name", "first_name")
    if date_from:
        qs = qs.filter(event__start_date__date__gte=date_from)
    if date_to:
        qs = qs.filter(event__start_date__date__lte=date_to)
    if event_ids:
        qs = qs.filter(event_id__in=event_ids)
    return qs


def group_by_person(participants) -> list[dict]:
    """Une ligne par personne (email) : dernières informations connues + ses événements."""
    people: dict[str, dict] = {}
    for p in participants:  # trié du plus récent au plus ancien
        key = p.email.lower()
        person = people.get(key)
        if person is None:
            person = people[key] = {
                "email": p.email, "first_name": p.first_name, "last_name": p.last_name,
                "nationality": p.nationality, "organisation": p.organisation, "profession": p.profession,
                "is_member": p.user_id is not None, "events": [],
            }
        person["is_member"] = person["is_member"] or p.user_id is not None
        person["events"].append({"id": str(p.event_id), "title": p.event.title, "start_date": p.event.start_date})
    return list(people.values())


def _workbook(headers, rows) -> bytes:
    import openpyxl
    from openpyxl.styles import Font

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Participants"
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for row in rows:
        ws.append(row)
    for column in ws.columns:
        width = max(len(str(c.value or "")) for c in column)
        ws.column_dimensions[column[0].column_letter].width = min(max(12, width + 2), 60)
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def _local(dt) -> str:
    return timezone.localtime(dt).strftime("%d/%m/%Y %H:%M") if dt else ""


def export_participants_excel(event) -> bytes:
    headers = ["Prénom", "Nom", "Email", "Nationalité", "Organisation", "Profession", "Raison de l'inscription", "Inscrit le"]
    rows = [
        [p.first_name, p.last_name, p.email, p.nationality, p.organisation, p.profession, p.motivation, _local(p.created_at)]
        for p in event.participants.order_by("last_name", "first_name")
    ]
    return _workbook(headers, rows)


def export_all_participants_excel(participants, by_person: bool = False) -> bytes:
    if by_person:
        headers = ["Prénom", "Nom", "Email", "Nationalité", "Organisation", "Profession", "Membre DAH",
                   "Nombre d'événements", "Événements"]
        rows = [
            [p["first_name"], p["last_name"], p["email"], p["nationality"], p["organisation"], p["profession"],
             "Oui" if p["is_member"] else "Non", len(p["events"]),
             " ; ".join(f"{e['title']} ({timezone.localtime(e['start_date']):%d/%m/%Y})" for e in p["events"])]
            for p in group_by_person(participants)
        ]
    else:
        headers = ["Événement", "Date de l'événement", "Prénom", "Nom", "Email", "Nationalité", "Organisation",
                   "Profession", "Membre DAH", "Raison de l'inscription", "Inscrit le"]
        rows = [
            [p.event.title, _local(p.event.start_date), p.first_name, p.last_name, p.email, p.nationality,
             p.organisation, p.profession, "Oui" if p.user_id else "Non", p.motivation, _local(p.created_at)]
            for p in participants
        ]
    return _workbook(headers, rows)


def send_event_reminder(event, sender, *, subject: str, message: str, test: bool = False) -> int:
    """Rappel du bureau aux inscrits, à tout moment. En mode test, seul
    l'expéditeur le reçoit (rien n'est enregistré dans l'historique)."""
    from .models import EventReminder
    from .tasks import send_event_reminder_email

    if test:
        recipients = [(sender.email, sender.first_name)]
    else:
        recipients = list(event.participants.values_list("email", "first_name"))
        if not recipients:
            raise ValidationError({"detail": "Aucun inscrit à prévenir pour cet événement."})
        EventReminder.objects.create(
            event=event, subject=subject, message=message, sent_by=sender, recipients=len(recipients),
        )

    def _send_all():
        for email, first_name in recipients:
            send_event_reminder_email(event, email=email, first_name=first_name, subject=subject, message=message)

    fire_and_forget(_send_all, error_message=f"Envoi du rappel de l'événement {event.pk} interrompu")
    return len(recipients)
