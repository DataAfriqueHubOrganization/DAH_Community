import random
import secrets
import string
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.common.background import fire_and_forget

User = get_user_model()


def accept_candidature(candidature, reviewed_by) -> "Candidature":
    """Accepte la candidature. Peut être appelé pour revenir sur un rejet précédent :
    dans ce cas, le compte utilisateur existant est réactivé plutôt que recréé."""
    from .models import Candidature
    from .tasks import send_welcome_email, send_membership_restored_email
    from apps.members.models import MemberProfile

    if candidature.status == Candidature.STATUS_ACCEPTED:
        raise ValidationError("Cette candidature est déjà acceptée.")

    if candidature.user_id:
        # Révision d'une décision précédente : on réactive le compte existant. On lui
        # régénère quand même un mot de passe temporaire — la personne ne peut pas être
        # certaine de connaître le précédent (jamais reçu, oublié, envoi échoué...).
        user = candidature.user
        temp_password = _restore_member_status(user)
        fire_and_forget(
            send_membership_restored_email.delay, user.pk, temp_password,
            error_message=f"Impossible d'envoyer l'email de réactivation à {user.email}",
        )
    elif (orphan_user := User.objects.filter(email=candidature.email).first()):
        # Compte existant mais non relié (ex: candidature d'origine supprimée après
        # acceptation, ou statut de membre perdu puis nouvelle candidature acceptée) :
        # on le relie/réactive plutôt que de tenter d'en recréer un et de percuter la
        # contrainte d'unicité sur l'email.
        user = orphan_user
        temp_password = _restore_member_status(user)
        fire_and_forget(
            send_membership_restored_email.delay, user.pk, temp_password,
            error_message=f"Impossible d'envoyer l'email de réactivation à {user.email}",
        )
    else:
        temp_password = _generate_temp_password()
        user = User.objects.create_user(
            email=candidature.email,
            first_name=candidature.first_name,
            last_name=candidature.last_name,
            phone=candidature.phone,
            role="membre",
            password=temp_password,
        )

        profile, _ = MemberProfile.objects.get_or_create(user=user)
        if not profile.member_number:
            profile.member_number = _generate_member_number()
            profile.save(update_fields=["member_number"])

        fire_and_forget(
            send_welcome_email.delay, user.pk, temp_password,
            error_message=f"Impossible d'envoyer l'email de bienvenue à {user.email}",
        )

    # Pas d'email de vérification : le compte est activé automatiquement à la
    # première connexion (voir DAHTokenObtainPairSerializer.validate).

    candidature.status = Candidature.STATUS_ACCEPTED
    candidature.reviewed_by = reviewed_by
    candidature.reviewed_at = timezone.now()
    candidature.rejection_reason = ""
    candidature.user = user
    candidature.save(update_fields=["status", "reviewed_by", "reviewed_at", "rejection_reason", "user"])

    return candidature


def reject_candidature(candidature, reviewed_by, reason: str) -> "Candidature":
    """Refuse la candidature. Peut être appelé pour revenir sur une acceptation précédente :
    dans ce cas, le compte utilisateur créé est désactivé plutôt que supprimé."""
    from .models import Candidature
    from .tasks import send_rejection_email

    if candidature.status == Candidature.STATUS_REJECTED:
        raise ValidationError("Cette candidature est déjà rejetée.")

    if candidature.user_id:
        user = candidature.user
        update_fields = []
        if user.is_active:
            user.is_active = False
            update_fields.append("is_active")
        # Ne rétrograde que le rôle "membre" simple — on ne touche pas aux rôles
        # promus (bureau, formateur, mentor...), qui restent une décision admin explicite.
        if user.role == "membre":
            user.role = "visiteur"
            update_fields.append("role")
        if update_fields:
            user.save(update_fields=update_fields)

    candidature.status = Candidature.STATUS_REJECTED
    candidature.reviewed_by = reviewed_by
    candidature.reviewed_at = timezone.now()
    candidature.rejection_reason = reason
    candidature.save(update_fields=["status", "reviewed_by", "reviewed_at", "rejection_reason"])

    fire_and_forget(
        send_rejection_email.delay, candidature.email, candidature.first_name, reason,
        error_message=f"Impossible d'envoyer l'email de refus à {candidature.email}",
    )

    return candidature


def _restore_member_status(user) -> str:
    """Réactive un compte, lui redonne le rôle membre (sans jamais rétrograder un
    rôle déjà promu : bureau, formateur, mentor...) et régénère un mot de passe
    temporaire — on ne peut pas supposer que la personne connaît encore l'ancien."""
    temp_password = _generate_temp_password()
    user.set_password(temp_password)
    update_fields = ["password"]
    if not user.is_active:
        user.is_active = True
        update_fields.append("is_active")
    if not user.is_member:
        user.role = "membre"
        update_fields.append("role")
    user.save(update_fields=update_fields)
    return temp_password


def _generate_temp_password() -> str:
    chars = string.ascii_letters + string.digits
    while True:
        pwd = "".join(secrets.choice(chars) for _ in range(12))
        if any(c.isupper() for c in pwd) and any(c.islower() for c in pwd) and any(c.isdigit() for c in pwd):
            return pwd


def _generate_member_number() -> str:
    from apps.members.models import MemberProfile
    year = timezone.now().year
    suffix = "".join(random.choices(string.digits, k=4))
    number = f"DAH-{year}-{suffix}"
    while MemberProfile.objects.filter(member_number=number).exists():
        suffix = "".join(random.choices(string.digits, k=4))
        number = f"DAH-{year}-{suffix}"
    return number
