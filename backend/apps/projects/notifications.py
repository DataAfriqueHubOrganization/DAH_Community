"""Email au membre à qui une tâche de projet vient d'être affectée."""
from django.conf import settings

from apps.common.background import fire_and_forget
from apps.common.email import send_branded_email
from apps.common.sanitize import clean_rich_text


def _description_html(description: str) -> str:
    from html import escape

    from apps.mailing.services import email_html

    if not description:
        return ""
    if description.lstrip().startswith("<"):
        return email_html(clean_rich_text(description))
    # Anciennes descriptions en texte brut : un paragraphe par bloc.
    blocks = [b.strip() for b in description.replace("\r\n", "\n").split("\n\n") if b.strip()]
    return email_html("".join(f"<p>{escape(b).replace(chr(10), '<br>')}</p>" for b in blocks))


def _tasks_url(project) -> str:
    site = settings.FRONTEND_URL.rstrip("/")
    if project.department_id:
        return f"{site}/manage/departments/{project.department_id}?tab=tasks&project={project.pk}"
    return f"{site}/my-department"


def send_task_assigned_email(task, by_name: str) -> None:
    project = task.project
    member = task.assigned_to
    send_branded_email(
        subject=f"Nouvelle tâche : {task.title}",
        recipient_list=[member.email],
        preheader=f"{by_name} vous a confié une tâche dans « {project.title} ».".strip(),
        title=task.title,
        greeting=f"Bonjour {member.first_name}," if member.first_name else "Bonjour,",
        paragraphs=[f"{by_name} vous a confié une nouvelle tâche." if by_name else "Une nouvelle tâche vous a été confiée."],
        details_title="La tâche",
        details=[
            ("Projet", project.title),
            ("Département", project.department.name if project.department else ""),
            ("Échéance", task.due_date.strftime("%d/%m/%Y") if task.due_date else ""),
            ("Points", f"{task.weight} (+1 si rendue à temps)" if task.due_date else str(task.weight)),
        ],
        body_html=_description_html(task.description),
        cta=("Voir mes tâches", _tasks_url(project)),
    )


def notify_task_assigned(task, *, by) -> None:
    """Prévient le membre affecté (en arrière-plan) — jamais quand il s'affecte
    lui-même la tâche."""
    member = task.assigned_to
    if member is None or member.pk == getattr(by, "pk", None) or not member.is_active:
        return
    fire_and_forget(send_task_assigned_email, task, by.full_name if by else "",
                    error_message=f"Email d'affectation de la tâche {task.pk} non envoyé")
