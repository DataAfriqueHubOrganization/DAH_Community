import pytest
from django.core import mail
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.departments.models import Department, DepartmentMembership
from apps.mailing import services
from apps.mailing.models import DailyEmailCount, MemberEmail, MemberEmailRecipient

URL = "/api/v1/mailing/emails/"


@pytest.fixture(autouse=True)
def _sync(settings, monkeypatch):
    settings.BREVO_API_KEY = ""          # backend email de Django : capturé dans mail.outbox
    settings.EMAIL_REDIRECT_TO = []
    settings.EMAIL_DAILY_QUOTA = 300
    # Envoi en arrière-plan exécuté tout de suite.
    monkeypatch.setattr("apps.mailing.services.fire_and_forget", lambda fn, *a, **k: fn(*a))


def make(email, role="membre", **kw):
    return User.objects.create_user(email=email, password="x", first_name=kw.pop("first_name", email.split("@")[0].title()),
                                    last_name=kw.pop("last_name", "Test"), role=role, **kw)


@pytest.fixture
def admin():
    return make("admin@exemple.org", role="admin", first_name="Ada")


@pytest.fixture
def client(admin):
    c = APIClient()
    c.force_authenticate(admin)
    return c


BODY = "<p>Bonjour {prénom} {nom},</p><p>Rendez-vous <strong>samedi</strong>.</p><script>alert(1)</script>"


@pytest.mark.django_db
def test_admin_only():
    c = APIClient()
    c.force_authenticate(make("awa@exemple.org", poste="president"))
    assert c.get(URL).status_code == 403
    assert c.post(URL, {"subject": "x", "body": "<p>x</p>", "user_ids": [1]}, format="json").status_code == 403


@pytest.mark.django_db
def test_send_to_selection_is_personalized_and_clean(client):
    awa = make("awa@exemple.org", first_name="Awa", last_name="Diop")
    kofi = make("kofi@exemple.org", first_name="Kofi", last_name="<b>Mensah</b>")
    make("candidat@exemple.org", role="candidat")
    cand = User.objects.get(email="candidat@exemple.org")

    r = client.post(URL, {"subject": "Salut {prénom}", "body": BODY, "template": "annonce",
                          "user_ids": [awa.id, kofi.id, cand.id],
                          "cta_label": "Voir", "cta_url": "https://dataafriquehub.org"}, format="json")
    assert r.status_code == 201, r.data
    assert r.data["total"] == 2 and r.data["audience_label"] == "Awa Diop, Kofi <b>Mensah</b>"

    assert sorted(m.to[0] for m in mail.outbox) == ["awa@exemple.org", "kofi@exemple.org"]
    to_awa = next(m for m in mail.outbox if m.to == ["awa@exemple.org"])
    assert to_awa.subject == "Salut Awa"
    html = to_awa.alternatives[0][0]
    assert "Bonjour Awa Diop," in html and "<script" not in html
    assert 'style="margin:0 0 16px 0;"' in html and "https://dataafriquehub.org" in html
    assert "Bonjour Awa Diop," in to_awa.body  # version texte
    to_kofi = next(m for m in mail.outbox if m.to == ["kofi@exemple.org"])
    assert "&lt;b&gt;Mensah&lt;/b&gt;" in to_kofi.alternatives[0][0]

    sent = MemberEmail.objects.get()
    assert sent.recipients.filter(status="sent").count() == 2
    assert DailyEmailCount.objects.get().count == 2


@pytest.mark.django_db
def test_groups(client, admin):
    make("pres@exemple.org", poste="president")
    lead = make("lead@exemple.org")
    member = make("m@exemple.org")
    make("visiteur@exemple.org", role="visiteur")
    dept = Department.objects.create(name="Data Engineering", lead=lead)
    DepartmentMembership.objects.create(department=dept, user=member, start_date="2026-01-01")

    summary = client.get(URL + "audiences/").data
    assert summary["groups"] == {"all": 3, "bureau": 1, "leads": 1}
    assert summary["departments"] == [{"id": dept.id, "name": "Data Engineering", "count": 2}]
    assert summary["quota"] == {"limit": 300, "sent_today": 0, "remaining": 300}

    r = client.post(URL, {"subject": "S", "body": "<p>x</p>", "audience": "department", "department": dept.id},
                    format="json")
    assert r.status_code == 201 and r.data["total"] == 2 and r.data["audience_label"] == "Département Data Engineering"


@pytest.mark.django_db
def test_test_send_goes_to_sender_only(client, admin):
    awa = make("awa@exemple.org")
    r = client.post(URL, {"subject": "S {prénom}", "body": "<p>x</p>", "user_ids": [awa.id], "test": True}, format="json")
    assert r.status_code == 200 and r.data["test"] is True
    assert [m.to for m in mail.outbox] == [["admin@exemple.org"]] and mail.outbox[0].subject == "S Ada"
    assert not MemberEmail.objects.exists()


@pytest.mark.django_db
def test_quota_blocks_oversized_send(client, settings):
    settings.EMAIL_DAILY_QUOTA = 2
    users = [make(f"u{i}@exemple.org") for i in range(3)]
    r = client.post(URL, {"subject": "S", "body": "<p>x</p>", "user_ids": [u.id for u in users]}, format="json")
    assert r.status_code == 400 and "Quota" in str(r.data)
    assert not mail.outbox


@pytest.mark.django_db
def test_failures_are_recorded_and_retried(client, monkeypatch):
    awa, kofi = make("awa@exemple.org"), make("kofi@exemple.org")
    real = services._deliver_one

    def flaky(fields, first, last, address, **kwargs):
        if address == "kofi@exemple.org":
            raise RuntimeError("adresse refusée")
        real(fields, first, last, address, **kwargs)

    monkeypatch.setattr(services, "_deliver_one", flaky)
    r = client.post(URL, {"subject": "S", "body": "<p>x</p>", "user_ids": [awa.id, kofi.id]}, format="json")
    detail = client.get(f"{URL}{r.data['id']}/").data
    assert (detail["sent"], detail["failed"]) == (1, 1)
    assert next(x for x in detail["recipients"] if x["address"] == "kofi@exemple.org")["error"] == "adresse refusée"

    monkeypatch.setattr(services, "_deliver_one", real)
    assert client.post(f"{URL}{r.data['id']}/retry/").data == {"retried": 1}
    assert MemberEmailRecipient.objects.filter(status="sent").count() == 2
    assert client.post(f"{URL}{r.data['id']}/retry/").status_code == 400


@pytest.mark.django_db
def test_validation(client):
    awa = make("awa@exemple.org")
    bad = [
        {"subject": "S", "body": "<p> </p>", "user_ids": [awa.id]},
        {"subject": "S", "body": "<p>x</p>"},
        {"subject": "S", "body": "<p>x</p>", "audience": "department"},
        {"subject": "S", "body": "<p>x</p>", "user_ids": [awa.id], "cta_url": "https://x.org"},
        {"subject": "S", "body": "<p>x</p>", "user_ids": [awa.id], "cta_label": "Go", "cta_url": "javascript:alert(1)"},
    ]
    for payload in bad:
        assert client.post(URL, payload, format="json").status_code == 400, payload


@pytest.mark.django_db
def test_preview_and_member_search(client):
    make("awa@exemple.org", first_name="Awa", last_name="Diop")
    make("cand@exemple.org", role="candidat", first_name="Awa")
    r = client.post(URL + "preview/", {"subject": "Hello {prénom}", "body": "<p>Bonjour {prénom}</p>"}, format="json")
    assert r.data["subject"] == "Hello Ada" and "Bonjour Ada" in r.data["html"]
    found = client.get(URL + "members/", {"search": "awa"}).data
    assert [m["email"] for m in found] == ["awa@exemple.org"]
