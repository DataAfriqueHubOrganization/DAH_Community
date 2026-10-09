import uuid
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.common.background import fire_and_forget
from apps.common.permissions import SECTIONS, has_section

FREQUENCY_DELTAS = {
    "weekly": timedelta(days=7),
    "biweekly": timedelta(days=14),
    "monthly": timedelta(days=30),
}
MAX_OCCURRENCES = 52


def can_manage_department(user, department) -> bool:
    """La section Départements gère tous les départements ; le lead/co-lead ne gère
    que le sien (membres, annonces, séances, tâches) — jamais son nom/description/
    lead/co-lead, réservés à la section (voir get_permissions de la vue)."""
    if has_section(user, SECTIONS.DEPARTMENTS):
        return True
    return department.lead_id == user.id or department.co_lead_id == user.id


def is_current_department_member(user, department) -> bool:
    today = timezone.now().date()
    return department.memberships.filter(user=user).filter(
        Q(end_date__isnull=True) | Q(end_date__gte=today)
    ).exists()


def get_user_department_ids(user) -> set:
    """Départements « à soi » : adhésion en cours, ou lead/co-lead. Sert à limiter
    ce qu'un membre voit des départements (ex. projets) à son propre département."""
    from .models import Department

    today = timezone.now().date()
    ids = set(
        user.department_memberships.filter(
            Q(end_date__isnull=True) | Q(end_date__gte=today)
        ).values_list("department_id", flat=True)
    )
    ids |= set(Department.objects.filter(Q(lead=user) | Q(co_lead=user)).values_list("id", flat=True))
    return ids


def get_department_member_ids(department) -> set:
    """Lead, co-lead et adhérents actuels d'un département — utilisé pour
    restreindre à qui un responsable peut assigner une tâche de projet."""
    if department is None:
        return set()
    today = timezone.now().date()
    ids = set(
        department.memberships.filter(
            Q(end_date__isnull=True) | Q(end_date__gte=today)
        ).values_list("user_id", flat=True)
    )
    ids.update(uid for uid in (department.lead_id, department.co_lead_id) if uid)
    return ids


def get_current_membership(user):
    from .models import DepartmentMembership

    today = timezone.now().date()
    return (
        DepartmentMembership.objects
        .filter(user=user)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
        .select_related("department")
        .order_by("-start_date")
        .first()
    )


def get_department_dict(user):
    """Représentation légère du département actif d'un utilisateur, réutilisée
    par les serializers accounts/members pour éviter de dupliquer la requête."""
    membership = get_current_membership(user)
    if not membership:
        return None
    return {
        "id": membership.department_id,
        "name": membership.department.name,
        "start_date": membership.start_date,
        "end_date": membership.end_date,
    }


def get_my_department_context(user):
    """Le département à afficher sur « Mon département » : sa propre adhésion en
    cours si elle existe, sinon le département qu'il dirige (lead/co-lead) même
    sans ligne d'adhésion formelle — nommer un lead ne l'inscrit pas forcément
    comme membre daté. Renvoie (department, since) où since peut être None."""
    from .models import Department

    membership = get_current_membership(user)
    if membership:
        return membership.department, membership.start_date

    led = Department.objects.filter(Q(lead=user) | Q(co_lead=user)).first()
    if led:
        return led, None

    return None, None


def _sync_lead_roles(department) -> None:
    """Nommer quelqu'un lead/co-lead lui attribue automatiquement le rôle
    responsable. Le retirer ne fait pas revenir son rôle en arrière
    (on ne sait pas quel était son rôle avant) — l'admin le change manuellement."""
    from apps.accounts.models import ROLES

    for user in filter(None, [department.lead, department.co_lead]):
        if user.role != ROLES.RESPONSABLE and user.role != ROLES.ADMIN:
            user.role = ROLES.RESPONSABLE
            user.save(update_fields=["role"])


def save_department(serializer) -> "Department":
    from .tasks import send_lead_appointed_email

    old_lead_id = serializer.instance.lead_id if serializer.instance else None
    old_co_lead_id = serializer.instance.co_lead_id if serializer.instance else None

    department = serializer.save()
    _sync_lead_roles(department)

    if department.lead_id and department.lead_id != old_lead_id:
        fire_and_forget(
            send_lead_appointed_email.delay, department.id, department.lead_id, "lead",
            error_message=f"Impossible de notifier la nomination lead du département {department.id}",
        )
    if department.co_lead_id and department.co_lead_id != old_co_lead_id:
        fire_and_forget(
            send_lead_appointed_email.delay, department.id, department.co_lead_id, "co_lead",
            error_message=f"Impossible de notifier la nomination co-lead du département {department.id}",
        )
    return department


def add_member(department, user, start_date, end_date=None) -> "DepartmentMembership":
    from .models import DepartmentMembership
    from .tasks import send_member_added_email

    with transaction.atomic():
        today = timezone.now().date()
        # Un membre n'a qu'une seule adhésion active à la fois, tous départements confondus.
        # Fin automatique silencieuse (pas d'email) — seule une fin explicite est notifiée.
        active_memberships = DepartmentMembership.objects.select_for_update().filter(
            user=user,
        ).filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
        for membership in active_memberships:
            if start_date < membership.start_date:
                raise ValidationError(
                    "La date de début ne peut pas précéder le début d'une adhésion "
                    "déjà en cours pour ce membre."
                )
            membership.end_date = start_date
            membership.save(update_fields=["end_date"])

        membership = DepartmentMembership.objects.create(
            department=department, user=user, start_date=start_date, end_date=end_date,
        )

    fire_and_forget(
        send_member_added_email.delay, membership.id,
        error_message=f"Impossible de notifier l'ajout de {user.email} au département {department.id}",
    )
    return membership


def end_membership(membership, end_date=None) -> "DepartmentMembership":
    from .tasks import send_membership_ended_email

    membership.end_date = end_date or timezone.now().date()
    if membership.end_date < membership.start_date:
        raise ValidationError("La date de fin ne peut pas précéder la date de début.")
    membership.save(update_fields=["end_date"])

    fire_and_forget(
        send_membership_ended_email.delay, membership.id,
        error_message=f"Impossible de notifier la fin d'adhésion {membership.id}",
    )
    return membership


def create_announcement(department, author, title, content) -> "DepartmentAnnouncement":
    from .models import DepartmentAnnouncement
    from .tasks import send_announcement_email

    announcement = DepartmentAnnouncement.objects.create(
        department=department, author=author, title=title, content=content,
    )
    fire_and_forget(
        send_announcement_email.delay, announcement.id,
        error_message=f"Impossible de notifier l'annonce {announcement.id}",
    )
    return announcement


def update_announcement(announcement, **fields) -> "DepartmentAnnouncement":
    for field, value in fields.items():
        setattr(announcement, field, value)
    announcement.save()
    return announcement


def create_session(
    department, created_by, date, theme="", meet_link="", frequency="none", occurrences=1,
) -> "DepartmentSession":
    from .models import DepartmentSession

    if frequency not in FREQUENCY_DELTAS:
        return DepartmentSession.objects.create(
            department=department, created_by=created_by, date=date,
            theme=theme, meet_link=meet_link, frequency="none",
        )

    occurrences = max(1, min(occurrences or 1, MAX_OCCURRENCES))
    delta = FREQUENCY_DELTAS[frequency]
    series_id = uuid.uuid4()
    created = DepartmentSession.objects.bulk_create([
        DepartmentSession(
            department=department, created_by=created_by, date=date + delta * i,
            theme=theme, meet_link=meet_link, frequency=frequency, series_id=series_id,
        )
        for i in range(occurrences)
    ])
    return created[0]


def update_session(session, **fields) -> "DepartmentSession":
    for field, value in fields.items():
        setattr(session, field, value)
    session.save()
    return session


def delete_session_series(session) -> None:
    """Supprime cette séance et toutes celles de la même série à partir de sa date
    (« arrêter la série ici ») — les occurrences passées de la série sont conservées."""
    from .models import DepartmentSession

    if not session.series_id:
        session.delete()
        return
    DepartmentSession.objects.filter(series_id=session.series_id, date__gte=session.date).delete()


def submit_session_report(session, report, present_user_ids) -> "DepartmentSession":
    session.report = report
    session.save(update_fields=["report"])
    session.present_members.set(present_user_ids)
    return session


def send_session_reminder(session) -> None:
    from .tasks import send_session_reminder_email

    fire_and_forget(
        send_session_reminder_email.delay, session.id,
        error_message=f"Impossible d'envoyer le rappel de la séance {session.id}",
    )


def create_task(
    department, created_by, title, description="", assigned_to=None, due_date=None, status="todo", size="medium",
) -> "DepartmentTask":
    from .models import DepartmentTask
    from .tasks import send_task_assigned_email

    task = DepartmentTask.objects.create(
        department=department, created_by=created_by, title=title, description=description,
        assigned_to=assigned_to, due_date=due_date, status=status, size=size,
    )
    if assigned_to:
        fire_and_forget(
            send_task_assigned_email.delay, task.id,
            error_message=f"Impossible de notifier l'assignation de la tâche {task.id}",
        )
    return task
