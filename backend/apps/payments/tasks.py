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
