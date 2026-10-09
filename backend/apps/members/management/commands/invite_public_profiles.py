"""
python manage.py invite_public_profiles [--dry-run] [--limit N]

Invite par email les membres à rendre leur profil visible sur le site public
(les profils sont masqués par défaut, voir la migration members 0004).

- Une seule invitation par membre (public_invite_sent_at) : on peut relancer la
  commande sans doublon, par exemple le lendemain si le quota du jour est atteint.
- S'arrête au quota d'emails du jour (EMAIL_DAILY_QUOTA), en gardant une marge
  pour les emails automatiques de la plateforme.
- À lancer en production uniquement : en pré-production, la base contient de
  vraies adresses.
"""
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.common.email import send_branded_email
from apps.mailing import quota
from apps.members.models import MemberProfile

RESERVE = 30  # emails gardés pour les envois automatiques du jour


class Command(BaseCommand):
    help = "Invite les membres à afficher leur profil sur le site public (une fois par membre)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Affiche les destinataires sans rien envoyer.")
        parser.add_argument("--limit", type=int, default=None, help="Nombre maximum d'invitations à envoyer.")

    def handle(self, *args, dry_run=False, limit=None, **options):
        from apps.payments.services import liable_members

        profiles = (
            MemberProfile.objects
            .filter(user__in=liable_members(), is_public=False, public_invite_sent_at__isnull=True)
            .select_related("user").order_by("user__first_name", "user__last_name")
        )
        total = profiles.count()
        budget = max(quota.remaining_today() - RESERVE, 0)
        if limit is not None:
            budget = min(budget, limit)
        batch = list(profiles[:budget])
        self.stdout.write(f"{total} membre(s) à inviter ; {len(batch)} invitation(s) aujourd'hui.")

        if dry_run:
            for profile in batch:
                self.stdout.write(f"  - {profile.user.full_name} <{profile.user.email}>")
            return

        site = settings.FRONTEND_URL.rstrip("/")
        sent = 0
        for profile in batch:
            user = profile.user
            try:
                send_branded_email(
                    subject="Votre profil sur le site de Data Afrique Hub",
                    recipient_list=[user.email],
                    preheader="Choisissez si votre profil apparaît dans l'annuaire public des membres.",
                    title="Apparaître dans l'annuaire des membres ?",
                    greeting=f"Bonjour {user.first_name}," if user.first_name else "Bonjour,",
                    paragraphs=[
                        "Le site de Data Afrique Hub présente ses membres dans un annuaire public, "
                        "pour faire connaître la communauté et vos compétences auprès des partenaires.",
                        "Par respect de vos données, votre profil n'y apparaît que si vous le décidez. "
                        "Il est actuellement masqué.",
                    ],
                    details_title="Ce qui serait visible",
                    details=[
                        ("Affiché", "nom, photo, rôle, département, compétences, bio, expériences, "
                                    "certifications, liens (LinkedIn, GitHub…)"),
                        ("Jamais affiché", "email, téléphone, CV"),
                    ],
                    cta=("Choisir dans Mon profil", f"{site}/profile#visibilite"),
                    after=["Vous pouvez changer d'avis à tout moment, au même endroit."],
                )
            except Exception as exc:  # noqa: BLE001 — on passe au suivant
                self.stderr.write(f"  ! {user.email} : {exc}")
                continue
            profile.public_invite_sent_at = timezone.now()
            profile.save(update_fields=["public_invite_sent_at"])
            sent += 1

        left = total - sent
        self.stdout.write(self.style.SUCCESS(f"{sent} invitation(s) envoyée(s)."))
        if left:
            self.stdout.write(f"{left} restante(s) : relancez la commande demain.")
