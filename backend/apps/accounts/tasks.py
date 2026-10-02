from urllib.parse import quote
from celery import shared_task
from django.conf import settings

from apps.common.email import send_branded_email


@shared_task(bind=True, max_retries=3)
def send_verification_email(self, user_pk: int, token: str):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return

    # Le token signé (django.core.signing) contient des ":" — beaucoup de clients
    # email (Gmail, Outlook...) coupent l'auto-détection de lien à ce caractère dans
    # un email en texte brut, pensant qu'il introduit un nouveau protocole. On encode
    # le token pour que le lien reste cliquable intégralement.
    verify_url = f"{settings.FRONTEND_URL}/verify-email/{quote(token, safe='')}"
    send_branded_email(
        subject="Vérifiez votre adresse email — Data Afrique Hub",
        recipient_list=[user.email],
        preheader="Confirmez votre adresse pour activer votre compte.",
        title="Confirmez votre adresse email",
        greeting=f"Bonjour {user.first_name},",
        paragraphs=["Pour activer votre compte Data Afrique Hub, confirmez votre adresse email en cliquant sur le bouton ci-dessous."],
        cta=("Vérifier mon email", verify_url),
        after=["Ce lien expire dans 24 heures."],
    )


@shared_task(bind=True, max_retries=3)
def send_password_reset_email(self, user_pk: int, token: str):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return

    reset_url = f"{settings.FRONTEND_URL}/reset-password/{quote(token, safe='')}"
    send_branded_email(
        subject="Réinitialisation de mot de passe — Data Afrique Hub",
        recipient_list=[user.email],
        preheader="Choisissez un nouveau mot de passe pour votre compte.",
        title="Réinitialisation de votre mot de passe",
        greeting=f"Bonjour {user.first_name},",
        paragraphs=["Vous avez demandé à réinitialiser le mot de passe de votre compte Data Afrique Hub."],
        cta=("Choisir un nouveau mot de passe", reset_url),
        after=["Ce lien expire dans 24 heures."],
        notice="Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe actuel reste inchangé.",
    )
