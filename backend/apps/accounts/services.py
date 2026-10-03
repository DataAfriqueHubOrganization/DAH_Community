from django.contrib.auth import get_user_model
from apps.common.background import fire_and_forget
from .tokens import make_email_verify_token, make_password_reset_token

User = get_user_model()


def send_verification_email_async(user: User) -> None:
    from .tasks import send_verification_email
    token = make_email_verify_token(user)
    fire_and_forget(
        send_verification_email.delay, user.pk, token,
        error_message=f"Impossible d'envoyer l'email de vérification à {user.email}",
    )


def send_password_reset_email_async(user: User) -> None:
    from .tasks import send_password_reset_email
    token = make_password_reset_token(user)
    fire_and_forget(
        send_password_reset_email.delay, user.pk, token,
        error_message=f"Impossible d'envoyer l'email de réinitialisation à {user.email}",
    )


def mark_email_verified(user: User) -> None:
    if not user.email_verified:
        user.email_verified = True
        user.save(update_fields=["email_verified"])


def verify_user_email(token: str) -> User:
    """Lien de vérification envoyé par email. N'est plus envoyé (le compte est
    activé à la première connexion), mais les liens déjà reçus restent valides."""
    from .tokens import read_email_verify_token
    user = read_email_verify_token(token)
    mark_email_verified(user)
    return user


def revoke_all_sessions(user: User) -> None:
    """Invalide tous les jetons de rafraîchissement : toutes les sessions ouvertes
    (autres appareils, éventuel attaquant) devront se reconnecter."""
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def reset_user_password(token: str, new_password: str) -> User:
    from .tokens import read_password_reset_token
    user = read_password_reset_token(token)
    user.set_password(new_password)
    user.save(update_fields=["password"])
    revoke_all_sessions(user)
    return user
