"""Emails de l'administration aux membres : destinataires, personnalisation, envoi."""
import logging
import re
from html import escape

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection
from django.db.models import Q
from django.utils import timezone
from django.utils.html import strip_tags
from rest_framework.exceptions import ValidationError

from apps.accounts.models import ROLES
from apps.common.background import fire_and_forget
from apps.common.email import send_branded_email

from . import quota
from .models import AUDIENCES, MemberEmail, MemberEmailRecipient, NewsletterSubscriber

logger = logging.getLogger(__name__)

# Variables reconnues dans l'objet et le message.
_FIRST_NAME = ("{prénom}", "{prenom}")
_LAST_NAME = ("{nom}",)


# ── Destinataires ──────────────────────────────────────────────────────────────
def mailable_users():
    """Comptes actifs pouvant recevoir un email de l'administration : les membres
    (membres, responsables, bureau, admins) — jamais les visiteurs ni les candidats."""
    return get_user_model().objects.filter(is_active=True).exclude(role__in=[ROLES.VISITEUR, ROLES.CANDIDAT])


def _leads_ids() -> set:
    from apps.payments.services import lead_user_ids
    return lead_user_ids()


def audience_queryset(audience: str, *, department=None, user_ids=None):
    """(queryset des destinataires, libellé lisible) pour un groupe."""
    from apps.departments.services import get_department_member_ids
    from apps.payments.services import liable_members

    if audience == AUDIENCES.ALL:
        return liable_members(), "Tous les membres actifs"
    if audience == AUDIENCES.BUREAU:
        return mailable_users().filter(poste__isnull=False), "Bureau"
    if audience == AUDIENCES.LEADS:
        return (mailable_users().filter(Q(role=ROLES.RESPONSABLE) | Q(id__in=_leads_ids())),
                "Responsables de département")
    if audience == AUDIENCES.DEPARTMENT:
        return (mailable_users().filter(id__in=get_department_member_ids(department)),
                f"Département {department.name}")
    users = mailable_users().filter(id__in=user_ids or [])
    names = [u.full_name for u in users.order_by("first_name", "last_name")[:3]]
    extra = users.count() - len(names)
    return users, ", ".join(names) + (f" et {extra} autre{'s' if extra > 1 else ''}" if extra > 0 else "")


def audiences_summary() -> dict:
    """Nombre de destinataires par groupe, départements et quota du jour (écran d'envoi)."""
    from apps.departments.models import Department

    def count(audience, **kw):
        return audience_queryset(audience, **kw)[0].count()

    return {
        "groups": {
            AUDIENCES.ALL: count(AUDIENCES.ALL),
            AUDIENCES.BUREAU: count(AUDIENCES.BUREAU),
            AUDIENCES.LEADS: count(AUDIENCES.LEADS),
        },
        "newsletter": NewsletterSubscriber.objects.filter(is_active=True).count(),
        "departments": [
            {"id": d.id, "name": d.name, "count": count(AUDIENCES.DEPARTMENT, department=d)}
            for d in Department.objects.order_by("name")
        ],
        "quota": quota_summary(),
    }


def quota_summary() -> dict:
    return {"limit": quota.daily_limit(), "sent_today": quota.sent_today(), "remaining": quota.remaining_today()}


def search_members(term: str, limit: int = 20):
    users = mailable_users().order_by("first_name", "last_name")
    for word in (term or "").split():
        users = users.filter(Q(first_name__icontains=word) | Q(last_name__icontains=word) | Q(email__icontains=word))
    return users[:limit]


# ── Contenu ────────────────────────────────────────────────────────────────────
def personalize(text: str, first_name: str, last_name: str, *, html: bool = False) -> str:
    first, last = (escape(first_name), escape(last_name)) if html else (first_name, last_name)
    for token in _FIRST_NAME:
        text = text.replace(token, first)
    for token in _LAST_NAME:
        text = text.replace(token, last)
    if not first_name:
        # Abonné à la newsletter (sans nom) : « Bonjour {prénom}, » → « Bonjour, ».
        text = re.sub(r"[ \t]+,", ",", text)
    return text


_INLINE_STYLES = {
    "p": "margin:0 0 16px 0;",
    "h2": "margin:8px 0 12px 0;font-family:'Open Sans',Arial,Helvetica,sans-serif;font-size:20px;line-height:1.3;color:#111114;",
    "h3": "margin:8px 0 10px 0;font-family:'Open Sans',Arial,Helvetica,sans-serif;font-size:17px;line-height:1.3;color:#111114;",
    "ul": "margin:0 0 16px 0;padding-left:22px;",
    "ol": "margin:0 0 16px 0;padding-left:22px;",
    "li": "margin:0 0 6px 0;",
    "blockquote": "margin:0 0 16px 0;padding:10px 16px;border-left:4px solid #FB7C2C;background-color:#FFF4EC;",
    "a": "color:#2F6FE0;",
    "img": "max-width:100%;height:auto;border-radius:8px;",
}
_OPEN_TAG = re.compile(r"<(%s)(\s[^>]*)?>" % "|".join(_INLINE_STYLES), re.IGNORECASE)


def email_html(body: str) -> str:
    """HTML nettoyé de l'éditeur → HTML d'email : styles en ligne (seuls fiables
    dans Gmail / Outlook)."""
    def add_style(match):
        tag, attrs = match.group(1).lower(), match.group(2) or ""
        return f'<{tag}{attrs} style="{_INLINE_STYLES[tag]}">'
    return _OPEN_TAG.sub(add_style, body)


def plain_text(body: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", body)
    text = re.sub(r"<li[^>]*>", "• ", text)
    text = re.sub(r"</li>\s*", "\n", text)
    text = re.sub(r"</(p|h2|h3|blockquote|ul|ol)>", "\n\n", text)
    text = strip_tags(text)
    text = re.sub(r"[ \t]*\n[ \t]*", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _unsubscribe_html(url: str) -> str:
    return ('<p style="font-size:13px;color:#71717A;">Vous recevez cet email car vous êtes abonné(e) à la '
            f'newsletter de Data Afrique Hub. <a href="{escape(url)}">Se désabonner</a></p>')


def unsubscribe_url(token) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/newsletter/unsubscribe?token={token}"


def _deliver_one(mail_fields: dict, first_name: str, last_name: str, address: str,
                 unsubscribe: str = "") -> None:
    body = personalize(mail_fields["body"], first_name, last_name, html=True)
    if unsubscribe:
        body += _unsubscribe_html(unsubscribe)
    text = plain_text(body)
    cta = (mail_fields["cta_label"], mail_fields["cta_url"]) if mail_fields.get("cta_url") else None
    send_branded_email(
        subject=personalize(mail_fields["subject"], first_name, last_name),
        recipient_list=[address],
        preheader=text.split("\n")[0][:120] if text else "",
        body_html=email_html(body),
        cta=cta,
    )


def render_preview(user, *, subject: str, body: str, cta_label: str = "", cta_url: str = "") -> dict:
    """Email tel que le recevra `user` (aperçu dans l'écran d'envoi)."""
    from apps.common.email import render_branded_email

    body = personalize(body, user.first_name, user.last_name, html=True)
    html = render_branded_email(
        subject=personalize(subject, user.first_name, user.last_name),
        body_html=email_html(body),
        cta=(cta_label, cta_url) if cta_url else None,
    )
    return {"subject": personalize(subject, user.first_name, user.last_name), "html": html}


# ── Envoi ──────────────────────────────────────────────────────────────────────
def send_test(sender, *, subject: str, body: str, cta_label: str = "", cta_url: str = "") -> int:
    """Envoi immédiat à l'expéditeur seul (rien n'est enregistré dans l'historique)."""
    if quota.remaining_today() < 1:
        raise ValidationError({"detail": "Quota d'emails du jour atteint : réessayez demain."})
    fields = {"subject": subject, "body": body, "cta_label": cta_label, "cta_url": cta_url}
    try:
        _deliver_one(fields, sender.first_name, sender.last_name, sender.email)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Email test aux membres en échec")
        raise ValidationError({"detail": "L'envoi du test a échoué. Réessayez dans un instant."}) from exc
    return 1


def send_member_email(sender, *, subject: str, body: str, template: str = "", cta_label: str = "",
                      cta_url: str = "", audience: str, department=None, user_ids=None) -> MemberEmail:
    if audience == AUDIENCES.NEWSLETTER:
        label = "Abonnés à la newsletter"
        recipients = [{"id": None, "email": e, "first_name": "", "last_name": ""}
                      for e in NewsletterSubscriber.objects.filter(is_active=True).order_by("email")
                      .values_list("email", flat=True)]
    else:
        users, label = audience_queryset(audience, department=department, user_ids=user_ids)
        recipients = list(users.order_by("first_name", "last_name").values("id", "email", "first_name", "last_name"))
    if not recipients:
        raise ValidationError({"detail": "Aucun destinataire pour cet envoi."})
    remaining = quota.remaining_today()
    if len(recipients) > remaining:
        raise ValidationError({"detail": (
            f"Quota d'emails du jour insuffisant : {len(recipients)} destinataire(s) pour {remaining} envoi(s) "
            "restant(s). Réduisez la liste ou envoyez demain."
        )})

    mail = MemberEmail.objects.create(
        subject=subject, body=body, template=template, cta_label=cta_label, cta_url=cta_url,
        audience=audience, audience_label=label[:200], sent_by=sender,
    )
    MemberEmailRecipient.objects.bulk_create([
        MemberEmailRecipient(email=mail, user_id=r["id"], address=r["email"],
                             first_name=r["first_name"], last_name=r["last_name"])
        for r in recipients
    ])
    fire_and_forget(deliver, mail.pk, error_message=f"Envoi de l'email aux membres {mail.pk} interrompu")
    return mail


def retry_failed(mail: MemberEmail) -> int:
    failed = mail.recipients.filter(status=MemberEmailRecipient.STATUS.FAILED)
    count = failed.count()
    if not count:
        raise ValidationError({"detail": "Aucun échec à renvoyer."})
    if count > quota.remaining_today():
        raise ValidationError({"detail": "Quota d'emails du jour insuffisant : réessayez demain."})
    failed.update(status=MemberEmailRecipient.STATUS.PENDING, error="")
    fire_and_forget(deliver, mail.pk, error_message=f"Renvoi de l'email aux membres {mail.pk} interrompu")
    return count


def deliver(mail_pk: int) -> None:
    """Envoie l'email à chaque destinataire en attente, un par un (arrière-plan)."""
    try:
        mail = MemberEmail.objects.get(pk=mail_pk)
        fields = {"subject": mail.subject, "body": mail.body, "cta_label": mail.cta_label, "cta_url": mail.cta_url}
        tokens = {}
        if mail.audience == AUDIENCES.NEWSLETTER:
            tokens = dict(NewsletterSubscriber.objects.values_list("email", "token"))
        for recipient in mail.recipients.filter(status=MemberEmailRecipient.STATUS.PENDING):
            if mail.audience == AUDIENCES.NEWSLETTER and not NewsletterSubscriber.objects.filter(
                    email=recipient.address, is_active=True).exists():
                # Désinscrit entre-temps : on n'envoie pas.
                recipient.status, recipient.error = MemberEmailRecipient.STATUS.FAILED, "Désinscrit"
                recipient.save(update_fields=["status", "error"])
                continue
            try:
                _deliver_one(fields, recipient.first_name, recipient.last_name, recipient.address,
                             unsubscribe=unsubscribe_url(tokens[recipient.address]) if recipient.address in tokens else "")
            except Exception as exc:  # noqa: BLE001 — un échec n'arrête pas les autres envois
                logger.warning("Email aux membres %s : échec pour %s", mail_pk, recipient.address)
                recipient.status = MemberEmailRecipient.STATUS.FAILED
                recipient.error = str(exc)[:255]
            else:
                recipient.status = MemberEmailRecipient.STATUS.SENT
                recipient.error = ""
                recipient.sent_at = timezone.now()
            recipient.save(update_fields=["status", "error", "sent_at"])
    finally:
        # Thread d'arrière-plan : on rend sa connexion à la base.
        if not connection.in_atomic_block:
            connection.close()


# ── Newsletter ─────────────────────────────────────────────────────────────────
def subscribe_newsletter(email: str, source: str = "site") -> NewsletterSubscriber:
    """Inscrit (ou réinscrit) une adresse. Sans effet si elle est déjà abonnée."""
    sub, created = NewsletterSubscriber.objects.get_or_create(email=email.strip().lower(), defaults={"source": source})
    if not created and not sub.is_active:
        sub.is_active, sub.unsubscribed_at = True, None
        sub.save(update_fields=["is_active", "unsubscribed_at"])
    return sub


def unsubscribe_newsletter(token) -> bool:
    sub = NewsletterSubscriber.objects.filter(token=token).first()
    if sub is None:
        return False
    if sub.is_active:
        sub.is_active, sub.unsubscribed_at = False, timezone.now()
        sub.save(update_fields=["is_active", "unsubscribed_at"])
    return True
