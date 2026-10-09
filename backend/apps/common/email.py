import logging
import time
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

_BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
_MAX_ATTEMPTS = 3
SENDER_NAME = "Data Afrique Hub"


def send_transactional_email(
    subject: str, message: str, recipient_list: list[str], html_message: str | None = None,
) -> None:
    """Envoie un email via l'API HTTP de Brevo (port 443) plutôt que le SMTP brut
    (port 587), dont la connexion sortante depuis Render (plan gratuit) subit des
    coupures réseau intermittentes (TimeoutError). Logue le contenu avant l'envoi
    pour garder une trace exploitable même en cas d'échec.

    Sans BREVO_API_KEY (développement local), repli sur le backend email de Django
    — en dev, le SMTP de Mailpit (http://localhost:8025) — pour pouvoir prévisualiser
    les emails sans clé Brevo."""
    # Pré-production : aucun email ne doit partir vers les vrais destinataires.
    redirect_to = getattr(settings, "EMAIL_REDIRECT_TO", [])
    if redirect_to:
        original = ", ".join(recipient_list)
        subject = f"[Préprod → {original}] {subject}"
        message = f"(Pré-production — destinataire réel : {original})\n\n{message}"
        recipient_list = list(redirect_to)

    logger.info(
        "Envoi email — À: %s — Sujet: %s\n%s",
        ", ".join(recipient_list), subject, message,
    )

    if not getattr(settings, "EMAIL_ENABLED", True):
        logger.info("Envoi des emails désactivé (EMAIL_ENABLED=false) : email non envoyé.")
        return

    if not settings.BREVO_API_KEY:
        email = EmailMultiAlternatives(
            subject, message, f"{SENDER_NAME} <{settings.DEFAULT_FROM_EMAIL}>", recipient_list,
        )
        if html_message:
            email.attach_alternative(html_message, "text/html")
        email.send()
        return

    payload = {
        "sender": {"name": SENDER_NAME, "email": settings.DEFAULT_FROM_EMAIL},
        "to": [{"email": addr} for addr in recipient_list],
        "subject": subject,
        "textContent": message,
    }
    if html_message:
        payload["htmlContent"] = html_message
    headers = {
        "accept": "application/json",
        "api-key": settings.BREVO_API_KEY,
        "content-type": "application/json",
    }

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            response = requests.post(_BREVO_API_URL, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            return
        except requests.RequestException:
            if attempt == _MAX_ATTEMPTS:
                raise
            logger.warning(
                "Envoi email à %s : tentative %s/%s échouée, nouvel essai...",
                ", ".join(recipient_list), attempt, _MAX_ATTEMPTS,
            )
            time.sleep(1)


def send_branded_email(
    subject: str,
    recipient_list: list[str],
    *,
    greeting: str = "",
    paragraphs: list[str] | tuple = (),
    title: str = "",
    details: list[tuple[str, str]] | tuple = (),
    details_title: str = "",
    notice: str = "",
    cta: tuple[str, str] | None = None,
    after: list[str] | tuple = (),
    closing: str = "À bientôt,\nL'équipe Data Afrique Hub",
    preheader: str = "",
) -> None:
    """Email aux couleurs de Data Afrique Hub (gabarit emails/base.html : logo,
    encadré de détails, bouton d'action, pied de page de la charte).

    Une version texte équivalente est toujours jointe, pour les clients mail qui
    n'affichent pas le HTML et pour les journaux.

      details : lignes « libellé → valeur » affichées dans un encadré bleu clair.
      notice  : message mis en avant (filet orange), ex. un conseil de sécurité.
      cta     : (libellé, url) — bouton principal ; l'URL est aussi donnée en clair.
      after   : paragraphes affichés après le bouton.
    """
    site_url = settings.FRONTEND_URL.rstrip("/")
    details = [(label, value) for label, value in details if value not in (None, "")]

    html_message = render_to_string("emails/base.html", {
        "subject": subject,
        "preheader": preheader,
        "title": title,
        "greeting": greeting,
        "paragraphs": paragraphs,
        "details": details,
        "details_title": details_title,
        "notice": notice,
        "cta_label": cta[0] if cta else "",
        "cta_url": cta[1] if cta else "",
        "after": after,
        "closing": closing,
        "site_url": site_url,
        "site_host": urlparse(site_url).netloc or site_url,
        # Logo servi par le frontend (public/brand) : une URL absolue est nécessaire
        # dans un email. PNG plutôt que SVG, non supporté par la plupart des clients.
        "logo_url": f"{site_url}/brand/full-color.png",
    })

    send_transactional_email(
        subject,
        _as_text(greeting, title, paragraphs, details, details_title, notice, cta, after, closing),
        recipient_list,
        html_message=html_message,
    )


def _as_text(greeting, title, paragraphs, details, details_title, notice, cta, after, closing) -> str:
    """Version texte brut de l'email, construite à partir des mêmes blocs."""
    blocks = []
    if title:
        blocks.append(title)
    if greeting:
        blocks.append(greeting)
    blocks.extend(paragraphs)
    if details:
        width = max(len(label) for label, _ in details)
        lines = [f"{details_title} :"] if details_title else []
        indent = "\n" + " " * (width + 5)  # valeurs multi-lignes alignées sous la 1re
        lines += [f"  {label.ljust(width)} : {str(value).replace(chr(10), indent)}" for label, value in details]
        blocks.append("\n".join(lines))
    if notice:
        blocks.append(notice)
    if cta:
        blocks.append(f"{cta[0]} : {cta[1]}")
    blocks.extend(after)
    blocks.append(closing)
    return "\n\n".join(blocks)
