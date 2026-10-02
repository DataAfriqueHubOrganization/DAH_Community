from celery import shared_task
from django.conf import settings

from apps.common.email import send_branded_email


def _engagement_details(c) -> list[tuple[str, str]]:
    """Lignes « souhaits d'engagement » d'une candidature, pour les encadrés."""
    rows = [("Engagement", "\n".join(c.get_engagements_display()))]
    if c.volunteer_poles:
        rows.append(("Pôles (bénévolat)", ", ".join(c.get_volunteer_poles_display())))
    return rows


def _credentials_email(user, temp_password: str, *, subject: str, title: str, intro: str):
    send_branded_email(
        subject=subject,
        recipient_list=[user.email],
        preheader="Vos identifiants de connexion à l'espace membre.",
        title=title,
        greeting=f"Bonjour {user.first_name},",
        paragraphs=[intro],
        details=[("Email", user.email), ("Mot de passe temporaire", temp_password)],
        details_title="Vos identifiants",
        cta=("Me connecter à mon espace", f"{settings.FRONTEND_URL}/login"),
        notice="Pour votre sécurité, changez ce mot de passe après votre première connexion (Mon profil → Changer le mot de passe).",
    )


@shared_task(bind=True, max_retries=3)
def send_candidature_received_notification(self, candidature_pk: int):
    from .models import Candidature
    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        c = Candidature.objects.get(pk=candidature_pk)
    except Candidature.DoesNotExist:
        return

    from django.db.models import Q
    recipients = list(
        User.objects.filter(Q(role="admin") | Q(poste="president"), is_active=True)
        .values_list("email", flat=True)
    )
    if not recipients:
        return

    send_branded_email(
        subject=f"Nouvelle candidature — {c.full_name}",
        recipient_list=recipients,
        preheader=f"{c.full_name} souhaite rejoindre la communauté.",
        title="Nouvelle candidature reçue",
        paragraphs=[f"{c.full_name} souhaite rejoindre la communauté Data Afrique Hub."],
        details=[
            ("Candidat", c.full_name),
            ("Email", c.email),
            ("Pays", c.country),
            ("Profession", c.profession),
            *_engagement_details(c),
        ],
        cta=("Examiner la candidature", f"{settings.FRONTEND_URL}/memberships/{c.pk}"),
        closing="L'équipe Data Afrique Hub",
    )


@shared_task(bind=True, max_retries=3)
def send_candidature_confirmation_email(self, candidature_pk: int):
    from .models import Candidature

    try:
        c = Candidature.objects.get(pk=candidature_pk)
    except Candidature.DoesNotExist:
        return

    send_branded_email(
        subject="Votre candidature a bien été reçue — Data Afrique Hub",
        recipient_list=[c.email],
        preheader="Notre équipe examine votre candidature.",
        title="Merci pour votre candidature !",
        greeting=f"Bonjour {c.first_name},",
        paragraphs=[
            "Nous avons bien reçu votre candidature pour rejoindre la communauté "
            "Data Afrique Hub. Notre équipe va l'examiner et reviendra vers vous "
            "par email dès qu'une décision sera prise.",
        ],
        details=[
            ("Pays", c.country),
            ("Profession", c.profession),
            *_engagement_details(c),
        ],
        details_title="Récapitulatif",
        closing="Merci pour votre intérêt et à bientôt,\nL'équipe Data Afrique Hub",
    )


@shared_task(bind=True, max_retries=3)
def send_welcome_email(self, user_pk: int, temp_password: str):
    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return

    _credentials_email(
        user, temp_password,
        subject="Bienvenue dans la communauté Data Afrique Hub !",
        title="Bienvenue dans la communauté !",
        intro="Votre candidature a été acceptée. Vous faites maintenant partie de la communauté Data Afrique Hub !",
    )


@shared_task(bind=True, max_retries=3)
def send_membership_restored_email(self, user_pk: int, temp_password: str):
    """Candidature acceptée en réutilisant un compte existant (retour en arrière
    après un refus, ou compte orphelin) : un nouveau mot de passe temporaire est
    communiqué, la personne ne pouvant pas être certaine de connaître l'ancien."""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return

    _credentials_email(
        user, temp_password,
        subject="Votre candidature a été acceptée — Data Afrique Hub",
        title="Votre candidature a été acceptée",
        intro="Votre candidature a été acceptée. Vous faites de nouveau partie de la communauté Data Afrique Hub !",
    )


@shared_task(bind=True, max_retries=3)
def send_rejection_email(self, email: str, first_name: str, reason: str):
    send_branded_email(
        subject="Votre candidature — Data Afrique Hub",
        recipient_list=[email],
        title="Réponse à votre candidature",
        greeting=f"Bonjour {first_name},",
        paragraphs=[
            "Nous avons examiné votre candidature pour rejoindre la communauté Data Afrique Hub "
            "et nous avons le regret de vous informer qu'elle n'a pas été retenue.",
        ],
        details=[("Motif", reason)],
        after=["Nous vous encourageons à postuler de nouveau dans le futur."],
        cta=("Suivre nos événements publics", f"{settings.FRONTEND_URL}/events"),
        closing="Cordialement,\nL'équipe Data Afrique Hub",
    )
