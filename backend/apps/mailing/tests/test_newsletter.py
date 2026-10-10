"""Newsletter : inscription publique, désinscription par lien, gestion et envoi."""
import pytest
from django.core import mail
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.mailing.models import NewsletterSubscriber

URL = "/api/v1/mailing/"


@pytest.fixture(autouse=True)
def _sync(settings, monkeypatch):
    settings.BREVO_API_KEY = ""
    settings.EMAIL_REDIRECT_TO = []
    monkeypatch.setattr("apps.mailing.services.fire_and_forget", lambda fn, *a, **k: fn(*a))


@pytest.fixture
def admin():
    c = APIClient()
    c.force_authenticate(User.objects.create_user(email="admin@exemple.org", password="x", first_name="A",
                                                  last_name="D", role="admin"))
    return c


@pytest.mark.django_db
def test_subscribe_is_idempotent_and_silent():
    c = APIClient()
    for _ in range(2):
        r = c.post(URL + "newsletter/subscribe/", {"email": " Awa@Exemple.org "}, format="json")
        assert r.status_code == 201
    assert list(NewsletterSubscriber.objects.values_list("email", flat=True)) == ["awa@exemple.org"]
    assert c.post(URL + "newsletter/subscribe/", {"email": "pas-un-email"}, format="json").status_code == 400


@pytest.mark.django_db
def test_unsubscribe_by_token_and_resubscribe():
    sub = NewsletterSubscriber.objects.create(email="awa@exemple.org")
    c = APIClient()
    assert c.post(URL + "newsletter/unsubscribe/", {"token": "nope"}, format="json").status_code == 400
    assert c.post(URL + "newsletter/unsubscribe/", {"token": str(sub.token)}, format="json").status_code == 200
    sub.refresh_from_db()
    assert not sub.is_active and sub.unsubscribed_at
    c.post(URL + "newsletter/subscribe/", {"email": "awa@exemple.org"}, format="json")
    sub.refresh_from_db()
    assert sub.is_active


@pytest.mark.django_db
def test_admin_manages_subscribers(admin):
    NewsletterSubscriber.objects.create(email="a@exemple.org")
    NewsletterSubscriber.objects.create(email="b@exemple.org", is_active=False)
    assert admin.post(URL + "newsletter/subscribers/", {"email": "c@exemple.org"}, format="json").status_code == 201
    data = admin.get(URL + "newsletter/subscribers/", {"status": "active"}).data
    rows = data["results"] if isinstance(data, dict) else data
    assert sorted(r["email"] for r in rows) == ["a@exemple.org", "c@exemple.org"]
    csv = admin.get(URL + "newsletter/subscribers/export/").content.decode()
    assert "b@exemple.org,non" in csv
    assert APIClient().get(URL + "newsletter/subscribers/").status_code == 401


@pytest.mark.django_db
def test_newsletter_send_has_unsubscribe_link_and_skips_unsubscribed(admin):
    active = NewsletterSubscriber.objects.create(email="a@exemple.org")
    NewsletterSubscriber.objects.create(email="b@exemple.org", is_active=False)
    r = admin.post(URL + "emails/", {"subject": "Les nouvelles", "body": "<p>Bonjour {prénom},</p><p>Du nouveau.</p>",
                                    "audience": "newsletter"}, format="json")
    assert r.status_code == 201 and r.data["total"] == 1
    assert [m.to for m in mail.outbox] == [["a@exemple.org"]]
    html = mail.outbox[0].alternatives[0][0]
    assert "Bonjour," in html and f"/newsletter/unsubscribe?token={active.token}" in html
    assert admin.get(URL + "emails/audiences/").data["newsletter"] == 1
