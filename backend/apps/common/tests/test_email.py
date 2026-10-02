import pytest
from django.core import mail

from apps.common.email import send_branded_email


@pytest.fixture(autouse=True)
def email_settings(settings):
    settings.BREVO_API_KEY = ""  # repli sur le backend email Django (locmem en test)
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.FRONTEND_URL = "https://dah.example.com/"
    settings.DEFAULT_FROM_EMAIL = "noreply@dah.example.com"


def test_email_html_et_texte_aux_couleurs_dah():
    send_branded_email(
        subject="Sujet test",
        recipient_list=["awa@example.com"],
        title="Titre <important>",
        greeting="Bonjour Awa,",
        paragraphs=["Premier paragraphe."],
        details=[("Pays", "Sénégal"), ("Lieu", ""), ("Pôles", "Data Tour, DAH Labs")],
        cta=("Ouvrir", "https://dah.example.com/login"),
    )

    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.subject == "Sujet test"
    assert message.from_email == "Data Afrique Hub <noreply@dah.example.com>"

    # Version texte : contenu complet, détails vides omis
    assert "Bonjour Awa," in message.body
    assert "Pays  : Sénégal" in message.body  # libellés alignés
    assert "Lieu" not in message.body
    assert "Ouvrir : https://dah.example.com/login" in message.body

    # Version HTML : logo absolu servi par le frontend, contenu échappé, bouton
    html, mimetype = message.alternatives[0]
    assert mimetype == "text/html"
    assert 'src="https://dah.example.com/brand/full-color.png"' in html
    assert "Titre &lt;important&gt;" in html
    assert 'href="https://dah.example.com/login"' in html
    assert "Data Tour, DAH Labs" in html
