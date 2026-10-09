"""
python manage.py seed_engagement

Données de démonstration pour les points, points d'étape, classement et
« membre du mois », sur les départements et comptes de démo (@dah.com).

- Idempotent : relancer la commande ne crée aucun doublon (get_or_create
  partout, points uniques par tâche / point d'étape).
- Aucun email envoyé : tout est créé directement en base (les adresses de démo
  sont fictives — des envois rebondiraient).
- Déterministe : génération pseudo-aléatoire à graine fixe.
"""
import random
from datetime import date, datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.common.demo import demo_password

User = get_user_model()

# Historique figé : de janvier à septembre 2026, quelle que soit la date d'exécution.
HISTORY_START = date(2026, 1, 5)
HISTORY_END = date(2026, 9, 28)
AWARD_MONTHS = [date(2026, m, 1) for m in range(1, 10)]  # membre du mois, janvier → septembre

# Membres supplémentaires pour un classement réaliste (2 par département).
EXTRA_MEMBERS = [
    ("aicha@dah.com", "Aïcha", "Koné", "Data Engineering", ["SQL", "Airflow", "Python"]),
    ("yao@dah.com", "Yao", "Mensah", "Data Engineering", ["Spark", "dbt", "Docker"]),
    ("fatoumata@dah.com", "Fatoumata", "Sow", "Machine Learning & MLOps", ["PyTorch", "MLflow", "Python"]),
    ("kwame@dah.com", "Kwame", "Asante", "Machine Learning & MLOps", ["Scikit-learn", "FastAPI", "NLP"]),
    ("mariam@dah.com", "Mariam", "Traoré", "Formation & Mentorat", ["Pédagogie", "Power BI", "Excel"]),
    ("ibrahim@dah.com", "Ibrahim", "Diallo", "Formation & Mentorat", ["Python", "Statistiques", "R"]),
]

# Niveau d'activité (nombre de tâches validées sur la période) : crée de l'écart.
ACTIVITY = {
    "felix@dah.com": 13, "bob@dah.com": 9, "aicha@dah.com": 12, "yao@dah.com": 6,
    "alice@dah.com": 15, "claire@dah.com": 8, "fatoumata@dah.com": 10, "kwame@dah.com": 5,
    "david@dah.com": 8, "emma@dah.com": 9, "mariam@dah.com": 12, "ibrahim@dah.com": 4,
}

TASK_POOL = {
    "Data Engineering": [
        "Optimiser le pipeline d'ingestion", "Documenter un modèle dbt", "Écrire des tests de qualité",
        "Migrer un job cron vers Airflow", "Corriger un import de données", "Monitorer la fraîcheur des tables",
        "Revue de code d'un pipeline", "Nettoyer un jeu de données partenaire",
    ],
    "Machine Learning & MLOps": [
        "Entraîner un modèle de référence", "Mettre en production un modèle", "Écrire une fiche modèle",
        "Évaluer un jeu de features", "Automatiser le réentraînement", "Comparer deux approches NLP",
        "Préparer une démo pour le meetup", "Suivre la dérive d'un modèle",
    ],
    "Formation & Mentorat": [
        "Préparer un support d'atelier", "Animer une séance de mentorat", "Rédiger un tutoriel débutant",
        "Corriger les exercices d'une cohorte", "Organiser un webinaire", "Mettre à jour le parcours Python",
        "Recueillir les retours d'une formation", "Créer un quiz d'évaluation",
    ],
}

FEEDBACKS = [
    "Merci pour ton implication sur cette période.\n\nPoints forts :\n- Fiabilité sur les délais\n- Très bonne entraide dans l'équipe\n\nAxes de progression :\n- Partager davantage ton avancement en réunion\n\nCe que nous mettons en place ensemble :\n- Un point mensuel en tête-à-tête",
    "Merci pour ton implication sur cette période.\n\nPoints forts :\n- Qualité des livrables\n- Prise d'initiative sur les sujets techniques\n\nAxes de progression :\n- Mieux estimer la charge des tâches\n\nCe que nous mettons en place ensemble :\n- Découper les grosses tâches avec toi en début de sprint",
    "Merci pour ton implication sur cette période.\n\nPoints forts :\n- Présence régulière aux séances\n\nAxes de progression :\n- Respect des échéances sur les tâches longues\n\nCe que nous mettons en place ensemble :\n- Des échéances intermédiaires et un binôme sur le prochain projet",
]

CRITERIA = ["participation", "follow_up", "quality", "teamwork", "initiative"]
DEMO_MARKER = "Tâche de démonstration."
LIVE_MARKER = "Tâche de démonstration en cours."
AWARD_NOTE = "Pour ton implication et la qualité de tes contributions ce mois-ci."


def _aware(day, hour=10):
    return timezone.make_aware(datetime.combine(day, time(hour, 0)))


def _quarter_label(day) -> str:
    return f"T{(day.month - 1) // 3 + 1} {day.year}"


class Command(BaseCommand):
    help = "Données de démo : tâches validées, points d'étape, classement, membre du mois"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset", action="store_true",
            help="Supprime d'abord les données générées par ce seed (démo uniquement), puis les recrée.",
        )

    def handle(self, *args, **options):
        from apps.departments.models import Department

        self.password = demo_password()

        if not User.objects.filter(email="admin@dah.com").exists() or not Department.objects.exists():
            self.stdout.write("  → Données de base absentes : lancement de seed_dah...")
            call_command("seed_dah")

        from apps.engagement.models import PointEntry

        if options["reset"]:
            self._reset()

        # Une seule exécution utile : la commande peut rester dans la commande de build
        # sans recréer de données à chaque déploiement.
        if PointEntry.objects.filter(project_task__description=DEMO_MARKER).exists():
            self.stdout.write("  → Démo engagement déjà présente : rien à faire.")
            return

        self.rng = random.Random(2026)
        self.today = timezone.localdate()
        with transaction.atomic():
            self._extra_members()
            self._task_history()
            self._live_tasks()
            self._checkins()
            self._awards()
        self.stdout.write(self.style.SUCCESS("✅ Seed engagement terminé."))

    # ── Membres ────────────────────────────────────────────────────────
    def _extra_members(self):
        from apps.departments.models import Department, DepartmentMembership
        from apps.members.models import MemberProfile

        self.stdout.write("  → Membres de démo supplémentaires...")
        for index, (email, first, last, dept_name, skills) in enumerate(EXTRA_MEMBERS, start=1):
            user, created = User.objects.get_or_create(
                email=email,
                defaults=dict(first_name=first, last_name=last, role="membre", email_verified=True),
            )
            if created:
                user.set_password(self.password)
                user.save()
            MemberProfile.objects.get_or_create(
                user=user,
                defaults=dict(skills=skills, member_number=f"DAH-2026-{900 + index}",
                              bio=f"Membre du département {dept_name}."),
            )
            department = Department.objects.filter(name=dept_name).first()
            if department and not DepartmentMembership.objects.filter(department=department, user=user).exists():
                DepartmentMembership.objects.create(
                    department=department, user=user, start_date=date(2025, 11, 1) + timedelta(days=index * 7),
                )

    def _department_people(self):
        """[(département, projet principal, [membres actifs])] pour les 3 départements de démo."""
        from apps.departments.models import Department
        from apps.departments.services import get_department_member_ids
        from apps.projects.models import Project

        result = []
        for name in TASK_POOL:
            department = Department.objects.filter(name=name).first()
            if not department:
                continue
            project = Project.objects.filter(department=department).order_by("created_at").first()
            if not project:
                project = Project.objects.create(
                    title=f"Projet de démo — {name}", description="Projet créé pour la démonstration.",
                    department=department, owner=department.lead, status="active",
                )
            members = list(User.objects.filter(
                id__in=get_department_member_ids(department), email__in=ACTIVITY,
            ).order_by("email"))
            result.append((department, project, members))
        return result

    # ── Historique de tâches validées ──────────────────────────────────
    def _task_history(self):
        from apps.engagement.models import PointEntry
        from apps.engagement.services import compute_task_points
        from apps.projects.models import ProjectTask

        self.stdout.write("  → Historique de tâches validées (janvier → septembre 2026)...")
        created_points = 0
        for department, project, members in self._department_people():
            pool = TASK_POOL[department.name]
            validator = department.lead or department.co_lead
            for member in members:
                for n in range(ACTIVITY[member.email]):
                    validated_on = HISTORY_START + timedelta(days=self.rng.randint(0, (HISTORY_END - HISTORY_START).days))
                    size = self.rng.choices(["small", "medium", "large"], weights=[3, 5, 2])[0]
                    on_time = self.rng.random() < 0.78
                    outstanding = self.rng.random() < 0.15
                    due = validated_on - timedelta(days=1)
                    submitted_on = due - timedelta(days=self.rng.randint(0, 3)) if on_time else due + timedelta(days=self.rng.randint(1, 4))
                    submitted_on = min(submitted_on, validated_on)
                    # Titre stable (sans date) : relancer la commande ne recrée rien.
                    title = f"{pool[(n + len(member.email)) % len(pool)]} — {member.first_name} #{n + 1}"

                    task, _ = ProjectTask.objects.get_or_create(
                        project=project, title=title,
                        defaults=dict(
                            description=DEMO_MARKER, assigned_to=member, size=size,
                            due_date=due, status="done", submitted_at=_aware(submitted_on, 9),
                        ),
                    )
                    if task.status != "done" or PointEntry.objects.filter(project_task=task).exists():
                        continue
                    points, punctual = compute_task_points(task, outstanding)
                    # Le responsable ne valide pas sa propre tâche : le bureau (admin) le fait.
                    reviewer = validator if validator and validator.id != member.id else User.objects.filter(email="admin@dah.com").first()
                    entry, made = PointEntry.objects.get_or_create(
                        project_task=task,
                        defaults=dict(
                            user=member, points=points, source=PointEntry.SOURCE_TASK, department=department,
                            label=f"{project.title} — {task.title}", on_time=punctual,
                            # Comptée au mois de soumission (règle du classement mensuel).
                            awarded_by=reviewer, awarded_at=_aware(submitted_on, 9),
                        ),
                    )
                    task.validated_at = _aware(validated_on, 17)
                    task.validated_by = reviewer
                    task.is_outstanding = outstanding
                    task.points_awarded = entry.points
                    task.save(update_fields=["validated_at", "validated_by", "is_outstanding", "points_awarded"])
                    created_points += made
        self.stdout.write(f"    + {created_points} attributions de points")

    # ── Tâches en cours de cycle (pour tester en direct) ───────────────
    def _live_tasks(self):
        from apps.projects.models import ProjectTask

        self.stdout.write("  → Tâches en cours (à valider, renvoyées, en retard)...")
        for department, project, members in self._department_people():
            others = [m for m in members if m.id not in (department.lead_id, department.co_lead_id)] or members
            if not others:
                continue
            specs = [
                ("Finaliser la documentation du sprint", "submitted", 2, "medium", "Lien vers la doc : drive/sprint-12"),
                ("Préparer la présentation du mois", "submitted", -1, "small", ""),
                ("Refaire le schéma d'architecture", "in_progress", 5, "large", None),
                ("Mettre à jour le tableau de suivi", "in_progress", -4, "small", None),
                ("Rédiger le compte rendu de la séance", "todo", 10, "small", None),
            ]
            for i, (title, status, due_in, size, note) in enumerate(specs):
                member = others[i % len(others)]
                task, created = ProjectTask.objects.get_or_create(
                    project=project, title=f"{title} — {department.name}",
                    defaults=dict(
                        description=LIVE_MARKER, assigned_to=member, size=size,
                        due_date=self.today + timedelta(days=due_in), status=status,
                    ),
                )
                if not created:
                    continue
                if status == "submitted":
                    task.submitted_at = _aware(self.today - timedelta(days=1), 15)
                    task.submission_note = note
                    task.save(update_fields=["submitted_at", "submission_note"])
                if i == 2:  # tâche renvoyée une fois par le responsable
                    task.return_reason = "Il manque la partie sur la sauvegarde des données — peux-tu la compléter ?"
                    task.save(update_fields=["return_reason"])

    # ── Points d'étape (mensuels) ─────────────────────────────────────
    def _checkins(self):
        from apps.engagement.models import CheckIn, PointEntry
        from apps.engagement.services import checkin_points, checkin_points_date, month_label

        self.stdout.write("  → Points d'étape mensuels (janvier à septembre 2026 confirmés, mois en cours ouvert)...")
        current_month = self.today.replace(day=1)

        for department, _project, members in self._department_people():
            manager = department.lead or department.co_lead
            for i, member in enumerate(m for m in members if m.id != (manager.id if manager else None)):
                base = 3 + (ACTIVITY[member.email] >= 9)
                self_scores = {}
                for month_start in AWARD_MONTHS:
                    if month_start >= current_month:
                        continue
                    self_scores = {k: max(1, min(5, base + self.rng.choice([-1, 0, 0, 1]))) for k in CRITERIA}
                    final_scores = {k: max(1, min(5, v + self.rng.choice([-1, 0, 0, 0, 1]))) for k, v in self_scores.items()}
                    # Rempli fin de mois, confirmé début du mois suivant.
                    confirmed_on = (month_start + timedelta(days=32)).replace(day=3)
                    checkin, _ = CheckIn.objects.get_or_create(
                        department=department, member=member, period_start=month_start,
                        defaults=dict(
                            period_label=month_label(month_start), launched_by=manager,
                            status=CheckIn.STATUS_CONFIRMED, self_scores=self_scores,
                            improve_self="Être plus régulier dans le suivi de mes tâches.",
                            department_help="Des points d'équipe plus courts mais plus fréquents.",
                            submitted_at=_aware(confirmed_on - timedelta(days=4)),
                            final_scores=final_scores,
                            feedback=FEEDBACKS[(i + month_start.month) % len(FEEDBACKS)],
                            confirmed_by=manager, confirmed_at=_aware(confirmed_on, 18),
                            points=checkin_points(final_scores),
                        ),
                    )
                    if checkin.status == CheckIn.STATUS_CONFIRMED:
                        PointEntry.objects.get_or_create(
                            checkin=checkin,
                            defaults=dict(
                                user=member, points=checkin.points, source=PointEntry.SOURCE_CHECKIN,
                                department=department, label=f"Point d'étape — {checkin.period_label}",
                                awarded_by=manager, awarded_at=checkin_points_date(checkin),
                            ),
                        )

                # Mois en cours : un sur deux rempli (à confirmer), les autres à remplir.
                submitted = i % 2 == 0
                CheckIn.objects.get_or_create(
                    department=department, member=member, period_start=current_month,
                    defaults=dict(
                        period_label=month_label(current_month), launched_by=manager,
                        due_date=self.today + timedelta(days=10),
                        status=CheckIn.STATUS_SUBMITTED if submitted else CheckIn.STATUS_PENDING,
                        self_scores=self_scores if submitted else {},
                        improve_self="Prendre davantage la parole en réunion." if submitted else "",
                        department_help="Un accompagnement sur les outils de déploiement." if submitted else "",
                        submitted_at=_aware(self.today - timedelta(days=1)) if submitted else None,
                    ),
                )

    # ── Membre du mois ────────────────────────────────────────────────
    def _awards(self):
        from apps.engagement.models import Award
        from apps.engagement.services import build_ranking, period_bounds

        self.stdout.write("  → Membres du mois (janvier à septembre 2026)...")
        admin = User.objects.filter(email="admin@dah.com").first()
        for month_start in AWARD_MONTHS:
            start, end = period_bounds("month", month_start)
            rows = build_ranking(start, end)
            if not rows or rows[0]["total"] == 0:
                continue
            Award.objects.update_or_create(
                kind=Award.KIND_MONTH, period_start=start,
                defaults=dict(user_id=rows[0]["user_id"], awarded_by=admin, note=AWARD_NOTE),
            )

    # ── Réinitialisation (démo uniquement) ────────────────────────────
    def _reset(self):
        """Supprime uniquement ce que ce seed a créé : tâches de démo (et leurs
        points), points d'étape des membres de démo, membres du mois de la démo."""
        from apps.engagement.models import Award, CheckIn, PointEntry
        from apps.projects.models import ProjectTask

        self.stdout.write("  → Réinitialisation des données de démo engagement...")
        demo_tasks = ProjectTask.objects.filter(description__in=[DEMO_MARKER, LIVE_MARKER])
        demo_checkins = CheckIn.objects.filter(member__email__in=ACTIVITY)
        PointEntry.objects.filter(project_task__in=demo_tasks).delete()
        PointEntry.objects.filter(checkin__in=demo_checkins).delete()
        deleted_tasks, _ = demo_tasks.delete()
        demo_checkins.delete()
        Award.objects.filter(note=AWARD_NOTE).delete()
        self.stdout.write(f"    - {deleted_tasks} tâches de démo supprimées")
