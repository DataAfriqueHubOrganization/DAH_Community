"""Points, classement, points d'étape et distinctions.

Règles (validées avec le bureau) :
- Une tâche rapporte des points uniquement quand le responsable la valide, et une
  seule fois (contrainte d'unicité sur PointEntry), même si elle est renvoyée puis
  resoumise plusieurs fois.
- Barème : petite 5, moyenne 10, grande 20 ; +20 % si soumise avant l'échéance,
  −25 % si soumise en retard ; +25 % si « travail remarquable ». La ponctualité
  se mesure à la date de SOUMISSION, pas de validation.
- Point d'étape (mensuel) : seuls les scores finaux du responsable comptent ;
  points = moyenne des 5 scores (1 à 5) × 4, soit 20 points au maximum.
- Points d'un mois = tâches SOUMISES dans le mois (et validées) + point d'étape
  DE ce mois (même confirmé plus tard) + ajustements du bureau.
"""
from datetime import date, datetime, time
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.common.background import fire_and_forget
from apps.common.mixins import ReviewableTaskMixin
from apps.common.permissions import is_bureau
from apps.departments.services import (
    can_manage_department, get_department_dict, get_department_member_ids,
)

from .models import Award, CheckIn, PointEntry

SIZE_POINTS = {"small": 5, "medium": 10, "large": 20}
ON_TIME_BONUS = Decimal("1.20")
LATE_PENALTY = Decimal("0.75")
OUTSTANDING_BONUS = Decimal("1.25")


def _round(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


# ── Tâches ────────────────────────────────────────────────────────────────

def task_department(task):
    """Département de rattachement d'une tâche (de département ou de projet)."""
    if hasattr(task, "department_id"):
        return task.department
    return task.project.department


def task_label(task) -> str:
    if hasattr(task, "project_id"):
        return f"{task.project.title} — {task.title}"
    return task.title


def _task_fk(task) -> dict:
    """Clé de la tâche dans PointEntry (department_task ou project_task)."""
    return {"project_task": task} if hasattr(task, "project_id") else {"department_task": task}


def can_validate_task(user, task) -> bool:
    """Responsable (lead/co-lead) du département de la tâche, ou bureau — jamais
    l'assigné lui-même : personne ne valide sa propre tâche."""
    if task.assigned_to_id == user.id:
        return False
    department = task_department(task)
    return is_bureau(user) or bool(department and can_manage_department(user, department))


def compute_task_points(task, outstanding: bool) -> tuple[int, bool | None]:
    """(points, à_temps) — à_temps vaut None quand la tâche n'a pas d'échéance."""
    points = Decimal(SIZE_POINTS.get(task.size, SIZE_POINTS["medium"]))
    on_time = None
    if task.due_date and task.submitted_at:
        on_time = timezone.localdate(task.submitted_at) <= task.due_date
        points *= ON_TIME_BONUS if on_time else LATE_PENALTY
    if outstanding:
        points *= OUTSTANDING_BONUS
    return _round(points), on_time


def check_free_status_change(task, new_status: str) -> None:
    """Changement de statut « libre » (sélecteur) : jamais vers À valider / Validée,
    qui passent par submit / validate, et jamais sur une tâche soumise ou validée."""
    if task.status == ReviewableTaskMixin.STATUS_DONE:
        raise ValidationError({"status": "Cette tâche est validée : son statut ne peut plus changer."})
    if task.status == ReviewableTaskMixin.STATUS_SUBMITTED and new_status != task.status:
        raise ValidationError({"status": "Tâche en attente de validation : le responsable doit la valider ou la renvoyer."})
    if new_status not in ReviewableTaskMixin.FREE_STATUSES and new_status != task.status:
        raise ValidationError({"status": "Utilisez « Soumettre pour validation » ou « Valider »."})


def submit_task(task, user, note: str = ""):
    if task.assigned_to_id != user.id:
        raise PermissionDenied("Seule la personne assignée peut soumettre cette tâche.")
    if task.status in (ReviewableTaskMixin.STATUS_SUBMITTED, ReviewableTaskMixin.STATUS_DONE):
        raise ValidationError("Cette tâche est déjà soumise ou validée.")
    task.status = ReviewableTaskMixin.STATUS_SUBMITTED
    task.submitted_at = timezone.now()
    task.submission_note = note
    task.return_reason = ""
    task.save(update_fields=["status", "submitted_at", "submission_note", "return_reason", "updated_at"])

    from .tasks import send_task_submitted_email
    fire_and_forget(
        send_task_submitted_email.delay, task._meta.label, task.pk,
        error_message=f"Notification de soumission impossible ({task._meta.label} {task.pk})",
    )
    return task


def validate_task(task, validator, outstanding: bool = False):
    if not can_validate_task(validator, task):
        raise PermissionDenied("Vous ne pouvez pas valider cette tâche.")
    if task.status != ReviewableTaskMixin.STATUS_SUBMITTED:
        raise ValidationError("La tâche doit d'abord être soumise pour validation.")

    points, on_time = compute_task_points(task, outstanding)
    with transaction.atomic():
        task.status = ReviewableTaskMixin.STATUS_DONE
        task.validated_at = timezone.now()
        task.validated_by = validator
        task.is_outstanding = outstanding
        entry = None
        if task.assigned_to_id:
            # get_or_create + contrainte d'unicité : jamais deux fois des points pour une tâche.
            entry, _ = PointEntry.objects.get_or_create(
                **_task_fk(task),
                defaults=dict(
                    user_id=task.assigned_to_id, points=points, source=PointEntry.SOURCE_TASK,
                    department=task_department(task), label=task_label(task), on_time=on_time,
                    # Comptée au mois où le membre a rendu la tâche, pas au mois de validation.
                    awarded_by=validator, awarded_at=task.submitted_at or task.validated_at,
                ),
            )
        task.points_awarded = entry.points if entry else None
        task.save(update_fields=[
            "status", "validated_at", "validated_by", "is_outstanding", "points_awarded", "updated_at",
        ])

    if entry:
        from .tasks import send_task_validated_email
        fire_and_forget(
            send_task_validated_email.delay, task._meta.label, task.pk,
            error_message=f"Notification de validation impossible ({task._meta.label} {task.pk})",
        )
    return task


def return_task(task, validator, reason: str):
    if not can_validate_task(validator, task):
        raise PermissionDenied("Vous ne pouvez pas renvoyer cette tâche.")
    if task.status != ReviewableTaskMixin.STATUS_SUBMITTED:
        raise ValidationError("Seule une tâche soumise peut être renvoyée.")
    if not reason.strip():
        raise ValidationError({"reason": "Indiquez le motif du renvoi."})
    task.status = "in_progress"
    task.return_reason = reason.strip()
    task.submitted_at = None
    task.save(update_fields=["status", "return_reason", "submitted_at", "updated_at"])

    from .tasks import send_task_returned_email
    fire_and_forget(
        send_task_returned_email.delay, task._meta.label, task.pk,
        error_message=f"Notification de renvoi impossible ({task._meta.label} {task.pk})",
    )
    return task


# ── Périodes ──────────────────────────────────────────────────────────────

PERIODS = ("month", "quarter", "year")


def period_bounds(period: str, ref: date) -> tuple[date, date]:
    """[début, fin[ de la période contenant ref."""
    if period == "month":
        start = ref.replace(day=1)
        end = date(start.year + (start.month == 12), start.month % 12 + 1, 1)
    elif period == "quarter":
        first_month = 3 * ((ref.month - 1) // 3) + 1
        start = date(ref.year, first_month, 1)
        end = date(ref.year + (first_month == 10), (first_month + 2) % 12 + 1, 1)
    elif period == "year":
        start = date(ref.year, 1, 1)
        end = date(ref.year + 1, 1, 1)
    else:
        raise ValidationError({"period": f"Période inconnue : {period}."})
    return start, end


def _aware(d: date) -> datetime:
    return timezone.make_aware(datetime.combine(d, time.min))


def entries_in(start: date, end: date):
    return PointEntry.objects.filter(awarded_at__gte=_aware(start), awarded_at__lt=_aware(end))


# ── Classement ────────────────────────────────────────────────────────────

def ranking_scopes(user) -> dict:
    """Ce qu'un utilisateur peut consulter : classement global (bureau) et/ou
    départements dont il est responsable. Un simple membre n'a accès à rien."""
    from apps.departments.models import Department

    if is_bureau(user):
        departments = Department.objects.order_by("name")
    else:
        departments = Department.objects.filter(Q(lead=user) | Q(co_lead=user)).order_by("name")
    return {"global": is_bureau(user), "departments": list(departments.values("id", "name"))}


def build_ranking(start: date, end: date, department=None) -> list[dict]:
    from django.contrib.auth import get_user_model
    User = get_user_model()

    entries = entries_in(start, end)
    if department is not None:
        entries = entries.filter(department=department)
    stats = {
        row["user_id"]: row
        for row in entries.values("user_id").annotate(
            total=Sum("points"),
            task_points=Sum("points", filter=Q(source=PointEntry.SOURCE_TASK)),
            checkin_points=Sum("points", filter=Q(source=PointEntry.SOURCE_CHECKIN)),
            adjustment_points=Sum("points", filter=Q(source=PointEntry.SOURCE_ADJUSTMENT)),
            contribution_points=Sum("points", filter=Q(source=PointEntry.SOURCE_CONTRIBUTION)),
            tasks_validated=Count("id", filter=Q(source=PointEntry.SOURCE_TASK)),
            tasks_on_time=Count("id", filter=Q(on_time=True)),
            tasks_with_deadline=Count("id", filter=Q(on_time__isnull=False)),
        )
    }
    user_ids = set(stats)
    if department is not None:
        # Le responsable voit aussi les membres sans points sur la période.
        user_ids |= get_department_member_ids(department)

    users = User.objects.filter(id__in=user_ids)
    rows = []
    for user in users:
        s = stats.get(user.id, {})
        with_deadline = s.get("tasks_with_deadline") or 0
        dept = get_department_dict(user)
        rows.append({
            "user_id": user.id,
            "full_name": user.full_name,
            "avatar": user.avatar.url if user.avatar else None,
            "department_name": dept["name"] if dept else None,
            "total": s.get("total") or 0,
            "task_points": s.get("task_points") or 0,
            "checkin_points": s.get("checkin_points") or 0,
            "adjustment_points": s.get("adjustment_points") or 0,
            "contribution_points": s.get("contribution_points") or 0,
            "tasks_validated": s.get("tasks_validated") or 0,
            "on_time_rate": round(100 * s.get("tasks_on_time", 0) / with_deadline) if with_deadline else None,
        })

    rows.sort(key=lambda r: (-r["total"], r["full_name"].lower()))
    # Classement « compétition » : ex aequo au même rang (1, 2, 2, 4).
    previous_total, previous_rank = None, 0
    for index, row in enumerate(rows, start=1):
        if row["total"] != previous_total:
            previous_rank, previous_total = index, row["total"]
        row["rank"] = previous_rank
    return rows


def department_leaders(start: date, end: date) -> list[dict]:
    """Meilleur membre de chaque département sur la période (vue communauté).
    Affiché dans le classement uniquement — le badge reste réservé au meilleur
    général (désigné par le bureau)."""
    from apps.departments.models import Department

    leaders = []
    for department in Department.objects.order_by("name"):
        rows = build_ranking(start, end, department)
        if rows and rows[0]["total"] > 0:
            best = rows[0]
            leaders.append({
                "department_id": department.id, "department_name": department.name,
                "user_id": best["user_id"], "full_name": best["full_name"], "avatar": best["avatar"],
                "total": best["total"],
                "tied": sum(1 for r in rows if r["total"] == best["total"]) > 1,
            })
    return leaders


def my_points(user, period: str, ref: date) -> dict:
    """Vue « Mes points » : total, historique et totaux mensuels de l'année.
    Jamais de classement ni de scores de point d'étape — une ligne par point d'étape."""
    start, end = period_bounds(period, ref)
    entries = entries_in(start, end).filter(user=user).order_by("-awarded_at")

    year_start = date(ref.year, 1, 1)
    monthly = {m: 0 for m in range(1, 13)}
    for row in (
        entries_in(year_start, date(ref.year + 1, 1, 1)).filter(user=user)
        .values("awarded_at__month").annotate(total=Sum("points"))
    ):
        monthly[row["awarded_at__month"]] = row["total"]

    return {
        "period": {"type": period, "start": start, "end": end},
        "total": sum(e.points for e in entries),
        "entries": [
            {
                "id": e.id, "label": e.label, "points": e.points, "source": e.source,
                "awarded_at": e.awarded_at, "on_time": e.on_time,
            }
            for e in entries
        ],
        "monthly": [{"month": m, "total": t} for m, t in monthly.items()],
    }


def adjust_points(user, points: int, reason: str, by, department=None) -> PointEntry:
    if not is_bureau(by):
        raise PermissionDenied("Seul le bureau peut ajuster des points.")
    if not reason.strip():
        raise ValidationError({"reason": "Le motif est obligatoire."})
    if points == 0:
        raise ValidationError({"points": "L'ajustement ne peut pas être nul."})
    return PointEntry.objects.create(
        user=user, points=points, source=PointEntry.SOURCE_ADJUSTMENT, department=department,
        label="Ajustement du bureau", reason=reason.strip(), awarded_by=by,
    )


# ── Points d'étape ────────────────────────────────────────────────────────

def _criteria_keys() -> list[str]:
    return [key for key, _ in CheckIn.CRITERIA]


def validate_scores(scores: dict) -> dict:
    keys = _criteria_keys()
    if set(scores) != set(keys):
        raise ValidationError({"scores": "Les 5 critères doivent être notés."})
    clean = {}
    for key in keys:
        value = scores[key]
        if not isinstance(value, int) or not 1 <= value <= 5:
            raise ValidationError({"scores": "Chaque score doit être un entier de 1 à 5."})
        clean[key] = value
    return clean


def checkin_points(final_scores: dict) -> int:
    mean = Decimal(sum(final_scores.values())) / Decimal(len(final_scores))
    return _round(mean * 4)


MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
             "août", "septembre", "octobre", "novembre", "décembre"]


def month_label(month_start: date) -> str:
    return f"{MONTHS_FR[month_start.month - 1]} {month_start.year}"


def checkin_points_date(checkin) -> datetime:
    """Date d'attribution des points d'un point d'étape : le 15 du mois évalué
    (milieu de mois, à l'abri des décalages de fuseau), sinon la confirmation."""
    if checkin.period_start:
        return _aware(checkin.period_start.replace(day=15))
    return checkin.confirmed_at


def launch_checkins(department, launched_by, member_ids, month: date, due_date=None) -> dict:
    """Point d'étape MENSUEL : un par membre, par département et par mois."""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    if not can_manage_department(launched_by, department):
        raise PermissionDenied("Vous ne gérez pas ce département.")
    period_start = month.replace(day=1)
    if period_start > timezone.localdate():
        raise ValidationError({"month": "Le mois évalué ne peut pas être dans le futur."})

    allowed = get_department_member_ids(department) - {launched_by.id}
    requested = set(member_ids) if member_ids else allowed
    if requested - allowed:
        raise ValidationError({"members": "Certaines personnes ne font pas partie du département."})

    # Un seul point d'étape (non annulé) par membre et par mois.
    already = set(
        CheckIn.objects.filter(department=department, member_id__in=requested, period_start=period_start)
        .exclude(status=CheckIn.STATUS_CANCELLED)
        .values_list("member_id", flat=True)
    )
    created = []
    for member in User.objects.filter(id__in=requested - already, is_active=True):
        created.append(CheckIn.objects.create(
            department=department, member=member, launched_by=launched_by,
            period_start=period_start, period_label=month_label(period_start), due_date=due_date,
        ))

    from .tasks import send_checkin_launched_email
    for checkin in created:
        fire_and_forget(
            send_checkin_launched_email.delay, checkin.pk,
            error_message=f"Notification de point d'étape impossible ({checkin.pk})",
        )
    return {"created": created, "skipped": len(requested) - len(created)}


def remind_checkins(department, user, month: date) -> int:
    """Relance par email les membres qui n'ont pas encore rempli le point d'étape du mois."""
    if not can_manage_department(user, department):
        raise PermissionDenied("Vous ne gérez pas ce département.")
    pending = list(CheckIn.objects.filter(
        department=department, period_start=month.replace(day=1), status=CheckIn.STATUS_PENDING,
    ).values_list("pk", flat=True))

    from .tasks import send_checkin_launched_email
    for pk in pending:
        fire_and_forget(
            send_checkin_launched_email.delay, pk, True,
            error_message=f"Relance de point d'étape impossible ({pk})",
        )
    return len(pending)


def submit_checkin(checkin, user, *, self_scores, improve_self, department_help, remark=""):
    if checkin.member_id != user.id:
        raise PermissionDenied("Ce point d'étape ne vous est pas destiné.")
    if checkin.status not in (CheckIn.STATUS_PENDING, CheckIn.STATUS_SUBMITTED):
        raise ValidationError("Ce point d'étape n'est plus modifiable.")
    first_submission = checkin.status == CheckIn.STATUS_PENDING
    checkin.self_scores = validate_scores(self_scores)
    checkin.improve_self = improve_self
    checkin.department_help = department_help
    checkin.remark = remark
    checkin.status = CheckIn.STATUS_SUBMITTED
    checkin.submitted_at = timezone.now()
    checkin.save()

    if first_submission:
        from .tasks import send_checkin_submitted_email
        fire_and_forget(
            send_checkin_submitted_email.delay, checkin.pk,
            error_message=f"Notification de réponse au point d'étape impossible ({checkin.pk})",
        )
    return checkin


def confirm_checkin(checkin, user, *, final_scores, feedback):
    if checkin.member_id == user.id or not can_manage_department(user, checkin.department):
        raise PermissionDenied("Vous ne pouvez pas confirmer ce point d'étape.")
    if checkin.status != CheckIn.STATUS_SUBMITTED:
        raise ValidationError("Le membre doit d'abord remplir son point d'étape.")
    if not feedback.strip():
        raise ValidationError({"feedback": "Le retour au membre est obligatoire."})

    scores = validate_scores(final_scores)
    points = checkin_points(scores)
    with transaction.atomic():
        checkin.final_scores = scores
        checkin.feedback = feedback.strip()
        checkin.points = points
        checkin.status = CheckIn.STATUS_CONFIRMED
        checkin.confirmed_by = user
        checkin.confirmed_at = timezone.now()
        checkin.save()
        PointEntry.objects.get_or_create(
            checkin=checkin,
            defaults=dict(
                user=checkin.member, points=points, source=PointEntry.SOURCE_CHECKIN,
                department=checkin.department, label=f"Point d'étape — {checkin.period_label}",
                # Compté dans le mois évalué, même si la confirmation arrive le mois suivant.
                awarded_by=user, awarded_at=checkin_points_date(checkin),
            ),
        )

    from .tasks import send_checkin_confirmed_email
    fire_and_forget(
        send_checkin_confirmed_email.delay, checkin.pk,
        error_message=f"Notification de retour de point d'étape impossible ({checkin.pk})",
    )
    return checkin


def cancel_checkin(checkin, user):
    if not can_manage_department(user, checkin.department):
        raise PermissionDenied("Vous ne gérez pas ce département.")
    if checkin.status not in (CheckIn.STATUS_PENDING, CheckIn.STATUS_SUBMITTED):
        raise ValidationError("Ce point d'étape ne peut plus être annulé.")
    checkin.status = CheckIn.STATUS_CANCELLED
    checkin.save(update_fields=["status", "updated_at"])
    return checkin


# ── Distinctions ──────────────────────────────────────────────────────────

def award_period_start(kind: str, ref: date) -> date:
    return ref.replace(day=1) if kind == Award.KIND_MONTH else date(ref.year, 1, 1)


def designate_award(user, kind: str, ref: date, by, note: str = "") -> Award:
    if not is_bureau(by):
        raise PermissionDenied("Seul le bureau peut désigner le membre du mois ou de l'année.")
    if kind not in dict(Award.KIND_CHOICES):
        raise ValidationError({"kind": "Type de distinction inconnu."})
    period_start = award_period_start(kind, ref)
    existing = Award.objects.filter(kind=kind, period_start=period_start).first()
    award, _ = Award.objects.update_or_create(
        kind=kind, period_start=period_start,
        defaults={"user": user, "note": note, "awarded_by": by},
    )
    if not existing or existing.user_id != user.id:
        from .tasks import send_award_email
        fire_and_forget(
            send_award_email.delay, award.pk,
            error_message=f"Email de distinction impossible ({award.pk})",
        )
    return award
