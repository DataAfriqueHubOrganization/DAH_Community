"""Pré-production : aucun email ne part vers les vrais membres."""
from django.core import mail

from apps.common.email import send_branded_email


def test_redirection_vers_la_boite_de_test(settings):
    settings.BREVO_API_KEY = ""  # backend email de Django (capturé par les tests)
    settings.EMAIL_REDIRECT_TO = ["preprod@dah.test"]
    send_branded_email(subject="Rappel de cotisation", recipient_list=["awa@exemple.org", "kofi@exemple.org"],
                       paragraphs=["Bonjour"])
    assert len(mail.outbox) == 1
    sent = mail.outbox[0]
    assert sent.to == ["preprod@dah.test"]
    assert sent.subject.startswith("[Préprod → awa@exemple.org, kofi@exemple.org]")
    assert "awa@exemple.org" in sent.body


def test_envoi_coupe(settings):
    settings.BREVO_API_KEY = ""
    settings.EMAIL_ENABLED = False
    send_branded_email(subject="Test", recipient_list=["awa@exemple.org"], paragraphs=["x"])
    assert mail.outbox == []


def test_sans_reglage_envoi_normal(settings):
    settings.BREVO_API_KEY = ""
    settings.EMAIL_REDIRECT_TO = []
    send_branded_email(subject="Test", recipient_list=["awa@exemple.org"], paragraphs=["x"])
    assert mail.outbox[0].to == ["awa@exemple.org"] and mail.outbox[0].subject == "Test"


def test_comptes_de_demo_jamais_envoyes_via_brevo(settings, monkeypatch):
    settings.BREVO_API_KEY = "cle-test"
    settings.EMAIL_REDIRECT_TO = []
    sent = []
    monkeypatch.setattr("apps.common.email.requests.post",
                        lambda url, json, **kw: sent.append(json) or type("R", (), {"raise_for_status": lambda self: None})())
    send_branded_email(subject="Test", recipient_list=["alice@dah.com"], paragraphs=["x"])
    assert sent == []
    send_branded_email(subject="Test", recipient_list=["alice@dah.com", "awa@exemple.org"], paragraphs=["x"])
    assert [r["email"] for r in sent[0]["to"]] == ["awa@exemple.org"]
