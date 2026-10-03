from celery import shared_task
from django.conf import settings

from apps.common.email import send_branded_email


def _fcfa(amount: int) -> str:
    return f"{amount:,}".replace(",", " ") + " FCFA"


@shared_task(bind=True, max_retries=3)
def send_contribution_receipt(self, contribution_pk):
    from .models import Contribution
    from .services import POINTS_PER_MONTH, period_label

    try:
        c = Contribution.objects.select_related("user").get(pk=contribution_pk)
    except Contribution.DoesNotExist:
        return

    send_branded_email(
        subject="Reçu de cotisation — Data Afrique Hub",
        recipient_list=[c.user.email],
        preheader=f"Cotisation reçue : {_fcfa(c.amount)}.",
        title="Merci pour votre cotisation",
        greeting=f"Bonjour {c.user.first_name},",
        paragraphs=[
            "Votre cotisation a bien été enregistrée par la trésorerie. Merci de faire vivre la communauté !",
        ],
        details_title="Reçu",
        details=[
            ("Période", period_label(c.period_start, c.months)),
            ("Montant", _fcfa(c.amount)),
            ("Payé le", f"{c.paid_on:%d/%m/%Y}"),
            ("Mode", c.get_method_display()),
            ("Référence", c.reference or f"COT-{c.pk}"),
            ("Points", f"+{POINTS_PER_MONTH * c.months} pts"),
        ],
        cta=("Voir mes cotisations", f"{settings.FRONTEND_URL}/my-contributions"),
    )


@shared_task(bind=True, max_retries=3)
def send_declaration_to_treasury(self, declaration_pk):
    from .models import PaymentDeclaration
    from .services import period_label, treasurer_emails

    try:
        d = PaymentDeclaration.objects.select_related("user").get(pk=declaration_pk)
    except PaymentDeclaration.DoesNotExist:
        return
    recipients = treasurer_emails()
    if not recipients:
        return
    send_branded_email(
        subject=f"Paiement à valider — {d.user.full_name}",
        recipient_list=recipients,
        preheader=f"{d.user.full_name} a déclaré une cotisation de {_fcfa(d.amount)}.",
        title="Un paiement attend votre validation",
        greeting="Bonjour,",
        paragraphs=[f"{d.user.full_name} a déclaré le paiement de sa cotisation, avec une capture de la preuve."],
        details=[
            ("Période", period_label(d.period_start, d.months)),
            ("Montant", _fcfa(d.amount)),
            ("Mode", d.get_method_display()),
            ("Référence", d.reference or "—"),
        ],
        cta=("Vérifier et valider", f"{settings.FRONTEND_URL}/treasury"),
    )


@shared_task(bind=True, max_retries=3)
def send_declaration_rejected(self, declaration_pk):
    from .models import PaymentDeclaration
    from .services import period_label

    try:
        d = PaymentDeclaration.objects.select_related("user").get(pk=declaration_pk)
    except PaymentDeclaration.DoesNotExist:
        return
    send_branded_email(
        subject="Votre déclaration de cotisation n'a pas été validée",
        recipient_list=[d.user.email],
        preheader="La trésorerie n'a pas pu valider votre paiement.",
        title="Déclaration non validée",
        greeting=f"Bonjour {d.user.first_name},",
        paragraphs=[f"La trésorerie n'a pas pu valider votre déclaration pour {period_label(d.period_start, d.months)}."],
        notice=f"Motif : {d.rejection_reason}",
        after=["Vous pouvez déclarer à nouveau ce paiement avec une preuve corrigée."],
        cta=("Mes cotisations", f"{settings.FRONTEND_URL}/my-contributions"),
    )


def send_contribution_reminder(user_pk, month_iso):
    """Rappel du mois (appelé en série par services.send_monthly_reminder)."""
    from datetime import date

    from django.contrib.auth import get_user_model

    from .services import member_situation, month_label

    user = get_user_model().objects.filter(pk=user_pk).first()
    if user is None:
        return
    month = date.fromisoformat(month_iso)
    situation = member_situation(user, month.year)
    late = situation["late_months"]
    paragraphs = [
        f"Petit rappel : la cotisation de {month_label(month)} ({_fcfa(situation['rate'])}) "
        "n'a pas encore été réglée. Chaque mois réglé vous rapporte aussi des points.",
    ]
    if late:
        paragraphs.append(
            "Mois en retard : " + ", ".join(month_label(m) for m in late) + "."
        )
    send_branded_email(
        subject=f"Rappel : cotisation de {month_label(month)}",
        recipient_list=[user.email],
        preheader=f"Il reste quelques jours pour régler la cotisation de {month_label(month)}.",
        title="Votre cotisation du mois",
        greeting=f"Bonjour {user.first_name},",
        paragraphs=paragraphs,
        details=[("Reste à régler", _fcfa(situation["owed"]))],
        after=["Une fois le paiement effectué, déclarez-le avec une capture : la trésorerie le valide et vos points sont ajoutés."],
        cta=("Déclarer mon paiement", f"{settings.FRONTEND_URL}/my-contributions"),
    )
