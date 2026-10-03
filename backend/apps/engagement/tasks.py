from celery import shared_task
from django.apps import apps
from django.conf import settings

from apps.common.email import send_branded_email


def _get_task(model_label: str, task_pk: int):
    """Tâche de département ou de projet, à partir de son label de modèle."""
    model = apps.get_model(model_label)
    try:
        return model.objects.select_related("assigned_to").get(pk=task_pk)
    except model.DoesNotExist:
        return None


def _department_url(department) -> str:
    if department is None:
        return f"{settings.FRONTEND_URL}/dashboard"
    return f"{settings.FRONTEND_URL}/manage/departments/{department.pk}"


def _validator_emails(department, exclude_user_id=None) -> list[str]:
    if department is None:
        return []
    users = [u for u in (department.lead, department.co_lead) if u and u.is_active and u.id != exclude_user_id]
    return [u.email for u in users]


@shared_task(bind=True, max_retries=3)
def send_task_submitted_email(self, model_label: str, task_pk: int):
    from .services import task_department, task_label

    task = _get_task(model_label, task_pk)
    if not task or not task.assigned_to:
        return
    department = task_department(task)
    recipients = _validator_emails(department, exclude_user_id=task.assigned_to_id)
    if not recipients:
        return

    send_branded_email(
        subject=f"Tâche à valider — {task.title}",
        recipient_list=recipients,
        preheader=f"{task.assigned_to.full_name} a terminé une tâche.",
        title="Une tâche attend votre validation",
        paragraphs=[f"{task.assigned_to.full_name} a soumis une tâche pour validation."],
        details=[
            ("Tâche", task_label(task)),
            ("Échéance", f"{task.due_date:%d/%m/%Y}" if task.due_date else ""),
            ("Note", task.submission_note),
        ],
        cta=("Valider ou renvoyer la tâche", _department_url(department)),
        closing="L'équipe Data Afrique Hub",
    )


@shared_task(bind=True, max_retries=3)
def send_task_validated_email(self, model_label: str, task_pk: int):
    from .services import task_department, task_label

    task = _get_task(model_label, task_pk)
    if not task or not task.assigned_to or task.points_awarded is None:
        return

    send_branded_email(
        subject=f"Tâche validée : +{task.points_awarded} points",
        recipient_list=[task.assigned_to.email],
        preheader=f"Votre tâche « {task.title} » a été validée.",
        title="Bravo, votre tâche est validée !",
        greeting=f"Bonjour {task.assigned_to.first_name},",
        paragraphs=[f"Votre tâche « {task_label(task)} » a été validée par votre responsable."],
        details=[("Points gagnés", f"+{task.points_awarded}")],
        notice="Travail remarqué par votre responsable : merci pour la qualité de votre contribution !"
        if task.is_outstanding else "",
        cta=("Voir mes points", f"{settings.FRONTEND_URL}/my-points"),
    )


@shared_task(bind=True, max_retries=3)
def send_task_returned_email(self, model_label: str, task_pk: int):
    from .services import task_department, task_label

    task = _get_task(model_label, task_pk)
    if not task or not task.assigned_to:
        return

    send_branded_email(
        subject=f"Tâche renvoyée — {task.title}",
        recipient_list=[task.assigned_to.email],
        preheader="Votre responsable vous demande quelques ajustements.",
        title="Quelques ajustements avant validation",
        greeting=f"Bonjour {task.assigned_to.first_name},",
        paragraphs=[f"Votre responsable a renvoyé la tâche « {task_label(task)} » avec le commentaire suivant :"],
        details=[("Commentaire", task.return_reason)],
        after=["Une fois les ajustements faits, soumettez-la de nouveau pour validation."],
        cta=("Voir mes tâches", _department_url(task_department(task))),
    )


@shared_task(bind=True, max_retries=3)
def send_checkin_launched_email(self, checkin_pk: int):
    from .models import CheckIn

    try:
        checkin = CheckIn.objects.select_related("member", "department").get(pk=checkin_pk)
    except CheckIn.DoesNotExist:
        return

    send_branded_email(
        subject=f"Point d'étape — {checkin.department.name}",
        recipient_list=[checkin.member.email],
        preheader="Quelques minutes pour faire le point sur votre implication.",
        title="Faisons le point ensemble",
        greeting=f"Bonjour {checkin.member.first_name},",
        paragraphs=[
            f"Votre responsable du département « {checkin.department.name} » vous propose un point "
            f"d'étape ({checkin.period_label}) : quelques questions rapides sur votre implication et sur "
            "ce que nous pourrions améliorer ensemble.",
        ],
        details=[("À remplir avant le", f"{checkin.due_date:%d/%m/%Y}" if checkin.due_date else "")],
        cta=("Remplir mon point d'étape", f"{settings.FRONTEND_URL}/checkins/{checkin.pk}"),
    )


@shared_task(bind=True, max_retries=3)
def send_checkin_submitted_email(self, checkin_pk: int):
    from .models import CheckIn

    try:
        checkin = CheckIn.objects.select_related("member", "department", "launched_by").get(pk=checkin_pk)
    except CheckIn.DoesNotExist:
        return

    recipients = set(_validator_emails(checkin.department, exclude_user_id=checkin.member_id))
    if checkin.launched_by and checkin.launched_by_id != checkin.member_id:
        recipients.add(checkin.launched_by.email)
    if not recipients:
        return

    send_branded_email(
        subject=f"Point d'étape rempli — {checkin.member.full_name}",
        recipient_list=sorted(recipients),
        title="Un point d'étape attend votre retour",
        paragraphs=[f"{checkin.member.full_name} a rempli son point d'étape ({checkin.period_label})."],
        cta=("Lire et confirmer", f"{settings.FRONTEND_URL}/checkins/{checkin.pk}"),
        closing="L'équipe Data Afrique Hub",
    )


@shared_task(bind=True, max_retries=3)
def send_checkin_confirmed_email(self, checkin_pk: int):
    from .models import CheckIn

    try:
        checkin = CheckIn.objects.select_related("member", "department").get(pk=checkin_pk)
    except CheckIn.DoesNotExist:
        return

    send_branded_email(
        subject=f"Retour sur votre point d'étape — {checkin.department.name}",
        recipient_list=[checkin.member.email],
        title="Votre responsable vous a fait un retour",
        greeting=f"Bonjour {checkin.member.first_name},",
        paragraphs=[f"Merci d'avoir pris le temps de faire le point ({checkin.period_label}). Voici le retour de votre responsable :"],
        notice=checkin.feedback,
        cta=("Voir mon espace", f"{settings.FRONTEND_URL}/my-points"),
    )


@shared_task(bind=True, max_retries=3)
def send_award_email(self, award_pk: int):
    from .models import Award

    try:
        award = Award.objects.select_related("user").get(pk=award_pk)
    except Award.DoesNotExist:
        return

    months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
              "août", "septembre", "octobre", "novembre", "décembre"]
    if award.kind == Award.KIND_MONTH:
        title = f"Membre du mois — {months[award.period_start.month - 1]} {award.period_start.year}"
    else:
        title = f"Membre de l'année {award.period_start.year}"

    send_branded_email(
        subject=f"Félicitations, vous êtes {title.split(' — ')[0].lower()} !",
        recipient_list=[award.user.email],
        preheader=title,
        title=f"Félicitations, {award.user.first_name} !",
        paragraphs=[
            f"Le bureau de Data Afrique Hub vous désigne {title}.",
            "Cette distinction salue votre implication et la qualité de vos contributions à la communauté. "
            "Elle apparaît désormais sur votre profil public.",
        ],
        notice=award.note,
        cta=("Voir mon profil", f"{settings.FRONTEND_URL}/profile"),
        closing="Merci pour tout,\nLe bureau de Data Afrique Hub",
    )
