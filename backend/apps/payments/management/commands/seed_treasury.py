"""Données de démo pour la trésorerie : cotisations de janvier à septembre 2026
et quelques écritures de caisse, sur les seuls comptes de démo (@dah.com) — les
vrais membres ne sont jamais modifiés.

Aucun email n'est envoyé. La commande ne fait rien si les données de démo sont
déjà présentes (repère DEMO_REFERENCE) ; --reset les supprime d'abord.

    python manage.py seed_treasury [--reset]
"""
import random
from datetime import date, datetime, time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import POSTES, ROLES
from apps.members.models import MemberProfile
from apps.memberships.models import Candidature
from apps.payments import services
from apps.payments.models import CashEntry, Contribution

DEMO_REFERENCE = "DEMO-DAH"
DEMO_DOMAIN = "@dah.com"
YEAR = 2026

# (jour, mois, type, catégorie, libellé, montant, mode)
CASH = [
    (18, 1, "expense", "tools", "Nom de domaine et hébergement", 45000, "transfer"),
    (10, 2, "income", "donations", "Don — Fondation Tech4Africa", 100000, "transfer"),
    (22, 2, "expense", "events", "Meetup février — location salle", 60000, "cash"),
    (14, 3, "expense", "communication", "Visuels réseaux sociaux", 25000, "mobile_money"),
    (5, 4, "income", "events_income", "Billetterie atelier dbt", 70000, "mobile_money"),
    (25, 4, "expense", "tools", "Abonnement Google Workspace (trimestre)", 21600, "transfer"),
    (12, 5, "income", "sponsorship", "Sponsoring — Orange Digital Center", 150000, "transfer"),
    (24, 5, "expense", "events", "Data Tour Dakar — logistique", 160000, "transfer"),
    (8, 6, "expense", "logistics", "Transport intervenants", 28000, "cash"),
    (15, 7, "expense", "communication", "Impression kakémonos", 30000, "mobile_money"),
    (20, 8, "income", "donations", "Don d'un membre fondateur", 50000, "mobile_money"),
    (30, 8, "expense", "events", "Pauses-café meetup août", 45000, "cash"),
    (15, 9, "income", "sponsorship", "Sponsoring — Data Tour Abidjan", 150000, "transfer"),
    (28, 9, "expense", "events", "Data Tour Abidjan — location salle", 85000, "transfer"),
    (29, 9, "expense", "events", "Data Tour Abidjan — pauses-café", 42000, "cash"),
]

METHODS = ["cash", "mobile_money", "mobile_money", "transfer"]


class Command(BaseCommand):
    help = "Cotisations et caisse de démonstration (janvier → septembre 2026), sans email."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Supprime d'abord les données de démo.")

    @transaction.atomic
    def handle(self, *args, reset=False, **options):
        if reset:
            Contribution.objects.filter(reference=DEMO_REFERENCE).delete()
            CashEntry.objects.filter(reference=DEMO_REFERENCE).delete()
        if Contribution.objects.filter(reference=DEMO_REFERENCE).exists():
            self.stdout.write("Trésorerie de démo déjà présente — rien à faire (--reset pour régénérer).")
            return

        rng = random.Random(2026)
        demo = services.liable_members().filter(email__iendswith=DEMO_DOMAIN)
        treasurer = (
            demo.filter(poste=POSTES.TRESORIER).first()
            or get_user_model().objects.filter(email__iendswith=DEMO_DOMAIN, role=ROLES.ADMIN).first()
        )
        members = list(demo.order_by("id"))
        if not members:
            self.stdout.write("Aucun compte de démo (@dah.com) — rien à faire.")
            return
        count = 0
        for index, user in enumerate(members):
            # Adhésion : la plupart en janvier, quelques arrivées en cours d'année.
            join_month = 1 if index % 5 else rng.choice([3, 5, 6])
            joined_at = timezone.make_aware(datetime.combine(date(YEAR, join_month, 3), time(10)))
            profile, _ = MemberProfile.objects.get_or_create(user=user)
            MemberProfile.objects.filter(pk=profile.pk).update(created_at=joined_at)
            Candidature.objects.filter(user=user, status=Candidature.STATUS_ACCEPTED).update(reviewed_at=joined_at)
            user = type(user).objects.get(pk=user.pk)

            # Profils variés : à jour, en retard, payé d'avance, jamais payé.
            profile_kind = index % 6
            if profile_kind == 5:
                continue  # jamais payé
            last_paid = {0: 9, 1: 8, 2: 12, 3: 6, 4: 9}[profile_kind]
            month = join_month
            while month <= last_paid:
                block = rng.choice([1, 1, 2, 3, 6]) if profile_kind != 2 else 12
                block = min(block, last_paid - month + 1)
                start = date(YEAR, month, 1)
                paid_on = date(YEAR, month, min(28, rng.randint(2, 20)))
                services.record_contribution(
                    member=user, recorded_by=treasurer, period_start=start, months=block,
                    paid_on=min(paid_on, date(YEAR, 9, 28)), method=rng.choice(METHODS),
                    reference=DEMO_REFERENCE, notify=False,
                )
                count += 1
                month += block

        for day, month, kind, category, label, amount, method in CASH:
            CashEntry.objects.create(
                kind=kind, category=category, label=label, amount=amount, date=date(YEAR, month, day),
                method=method, reference=DEMO_REFERENCE, recorded_by=treasurer,
            )
        self.stdout.write(self.style.SUCCESS(
            f"Trésorerie de démo : {count} paiements de cotisation, {len(CASH)} écritures de caisse."
        ))
