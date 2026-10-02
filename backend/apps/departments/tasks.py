from celery import shared_task
from django.conf import settings

from apps.common.email import send_branded_email

ROLE_LABELS = {"lead": "responsable", "co_lead": "co-responsable"}


def _department_url(department) -> str:
    return f"{settings.FRONTEND_URL}/manage/departments/{department.pk}"


@shared_task(bind=True, max_retries=3)
def send_member_added_email(self, membership_pk: int):
    from .models import DepartmentMembership

    try:
        membership = DepartmentMembership.objects.select_related("department", "user").get(pk=membership_pk)
    except DepartmentMembership.DoesNotExist:
        return

    department = membership.department
    send_branded_email(
        subject=f"Vous rejoignez le département {department.name} — Data Afrique Hub",
        recipient_list=[membership.user.email],
        preheader=f"Bienvenue dans le département {department.name}.",
        title=f"Bienvenue dans le département {department.name}",
        greeting=f"Bonjour {membership.user.first_name},",
        paragraphs=[f"Vous avez été ajouté(e) au département « {department.name} »."],
        details=[("Depuis le", f"{membership.start_date:%d/%m/%Y}")],
        cta=("Voir mon département", _department_url(department)),
    )


@shared_task(bind=True, max_retries=3)
def send_membership_ended_email(self, membership_pk: int):
    from .models import DepartmentMembership

    try:
        membership = DepartmentMembership.objects.select_related("department", "user").get(pk=membership_pk)
    except DepartmentMembership.DoesNotExist:
        return

    send_branded_email(
        subject=f"Fin de votre adhésion au département {membership.department.name} — Data Afrique Hub",
        recipient_list=[membership.user.email],
        title="Fin de votre adhésion au département",
        greeting=f"Bonjour {membership.user.first_name},",
        paragraphs=[
            f"Votre adhésion au département « {membership.department.name} » a pris fin "
            f"le {membership.end_date:%d/%m/%Y}.",
            "Vous restez membre de la communauté Data Afrique Hub.",
        ],
        closing="Merci pour votre contribution,\nL'équipe Data Afrique Hub",
    )


@shared_task(bind=True, max_retries=3)
def send_lead_appointed_email(self, department_pk: int, user_pk: int, role: str):
    from django.contrib.auth import get_user_model
    from .models import Department
    User = get_user_model()

    try:
        department = Department.objects.get(pk=department_pk)
        user = User.objects.get(pk=user_pk)
    except (Department.DoesNotExist, User.DoesNotExist):
        return

    role_label = ROLE_LABELS.get(role, role)
    send_branded_email(
        subject=f"Vous êtes {role_label} du département {department.name} — Data Afrique Hub",
        recipient_list=[user.email],
        preheader=f"Vous avez été nommé(e) {role_label} du département {department.name}.",
        title=f"Vous êtes {role_label} du département {department.name}",
        greeting=f"Bonjour {user.first_name},",
        paragraphs=[
            f"Vous avez été nommé(e) {role_label} du département « {department.name} ».",
            "Vous pouvez désormais gérer ses membres, publier des annonces, organiser "
            "les séances et suivre les tâches de l'équipe.",
        ],
        cta=("Gérer le département", _department_url(department)),
    )


@shared_task(bind=True, max_retries=3)
def send_announcement_email(self, announcement_pk: int):
    from django.db.models import Q
    from django.utils import timezone
    from .models import DepartmentAnnouncement

    try:
        announcement = DepartmentAnnouncement.objects.select_related("department").get(pk=announcement_pk)
    except DepartmentAnnouncement.DoesNotExist:
        return

    today = timezone.now().date()
    recipients = list(
        announcement.department.memberships
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
        .values_list("user__email", flat=True)
    )
    if not recipients:
        return

    send_branded_email(
        subject=f"[{announcement.department.name}] {announcement.title}",
        recipient_list=recipients,
        preheader=f"Nouvelle annonce du département {announcement.department.name}.",
        title=announcement.title,
        paragraphs=[
            f"Nouvelle annonce dans le département « {announcement.department.name} » :",
            announcement.content,
        ],
        cta=("Voir le département", _department_url(announcement.department)),
        closing="L'équipe Data Afrique Hub",
    )


@shared_task(bind=True, max_retries=3)
def send_session_reminder_email(self, session_pk: int):
    from django.db.models import Q
    from django.utils import timezone
    from .models import DepartmentSession

    try:
        session = DepartmentSession.objects.select_related("department").get(pk=session_pk)
    except DepartmentSession.DoesNotExist:
        return

    today = timezone.now().date()
    recipients = list(
        session.department.memberships
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
        .values_list("user__email", flat=True)
    )
    if not recipients:
        return

    send_branded_email(
        subject=f"Rappel — Séance du département {session.department.name}",
        recipient_list=recipients,
        preheader=f"Séance prévue le {session.date:%d/%m/%Y}.",
        title=f"Rappel : séance du département {session.department.name}",
        paragraphs=[f"Une séance du département « {session.department.name} » est prévue prochainement."],
        details=[
            ("Date", f"{session.date:%d/%m/%Y}"),
            ("Thème", session.theme),
        ],
        cta=("Rejoindre la réunion", session.meet_link) if session.meet_link else None,
    )


@shared_task(bind=True, max_retries=3)
def send_task_assigned_email(self, task_pk: int):
    from .models import DepartmentTask

    try:
        task = DepartmentTask.objects.select_related("department", "assigned_to").get(pk=task_pk)
    except DepartmentTask.DoesNotExist:
        return
    if not task.assigned_to:
        return

    send_branded_email(
        subject=f"Nouvelle tâche assignée — {task.department.name}",
        recipient_list=[task.assigned_to.email],
        preheader=task.title,
        title="Une nouvelle tâche vous a été assignée",
        greeting=f"Bonjour {task.assigned_to.first_name},",
        paragraphs=[f"Une nouvelle tâche vous a été assignée dans le département « {task.department.name} »."],
        details=[
            ("Tâche", task.title),
            ("Description", task.description),
            ("Échéance", f"{task.due_date:%d/%m/%Y}" if task.due_date else ""),
        ],
        cta=("Voir mes tâches", f"{settings.FRONTEND_URL}/my-department"),
    )
