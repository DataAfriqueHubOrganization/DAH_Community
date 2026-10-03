import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.events.models import Event

User = get_user_model()


@pytest.fixture
def bureau(db):
    user = User.objects.create_user(email="pdt@dah.test", password="x", first_name="P", last_name="", role="membre", poste="president")
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.mark.django_db
def test_creation_depuis_l_editeur_renvoie_l_id_et_vide_les_champs_optionnels(bureau):
    r = bureau.post("/api/v1/events/", {
        "title": "Data Tour", "description": "<p>Programme</p>", "event_type": "conference",
        "start_date": "2026-11-20T09:00", "end_date": "", "registration_deadline": "",
        "location": "Abidjan", "online_link": "", "max_participants": "", "is_published": "false",
    }, format="multipart")
    assert r.status_code == 201, r.data
    event = Event.objects.get(pk=r.data["id"])
    assert event.end_date is None and event.max_participants is None and not event.is_published

    # Passage en ligne : le lieu est vidé, le lien renseigné.
    r = bureau.patch(f"/api/v1/events/{event.pk}/", {
        "location": "", "online_link": "https://meet.google.com/abc", "is_published": "true",
    }, format="multipart")
    assert r.status_code == 200
    event.refresh_from_db()
    assert event.location == "" and event.online_link and event.is_published


@pytest.mark.django_db
class TestReminders:
    @pytest.fixture
    def event(self):
        from django.utils import timezone
        event = Event.objects.create(title="Data Tour", description="d", event_type="conference",
                                     start_date=timezone.now() + timezone.timedelta(days=3), location="Abidjan", is_published=True)
        for i, name in enumerate(["Awa", "Kofi"]):
            event.participants.create(email=f"p{i}@test.org", first_name=name, last_name="X", nationality="CI",
                                      organisation="o", profession="p", motivation="m")
        return event

    def test_envoi_a_tous_les_inscrits_et_historique(self, bureau, event, monkeypatch):
        sent = []
        monkeypatch.setattr("apps.events.services.fire_and_forget", lambda fn, **k: fn())
        monkeypatch.setattr("apps.events.tasks.send_branded_email", lambda **kw: sent.append(kw))
        r = bureau.post(f"/api/v1/events/{event.pk}/remind/", {
            "subject": "Rappel : Data Tour", "message": "Petit rappel.\n\nÀ bientôt !",
        }, format="json")
        assert r.status_code == 200 and r.data["sent"] == 2
        assert sorted(m["recipient_list"][0] for m in sent) == ["p0@test.org", "p1@test.org"]
        assert sent[0]["paragraphs"] == ["Petit rappel.", "À bientôt !"]
        assert ("Lieu", "Abidjan") in sent[0]["details"]
        history = bureau.get(f"/api/v1/events/{event.pk}/reminders/").data
        assert len(history) == 1 and history[0]["recipients"] == 2

    def test_mode_test_seulement_a_soi(self, bureau, event, monkeypatch):
        sent = []
        monkeypatch.setattr("apps.events.services.fire_and_forget", lambda fn, **k: fn())
        monkeypatch.setattr("apps.events.tasks.send_branded_email", lambda **kw: sent.append(kw))
        r = bureau.post(f"/api/v1/events/{event.pk}/remind/", {"subject": "S", "message": "M", "test": True}, format="json")
        assert r.data["sent"] == 1 and sent[0]["recipient_list"] == ["pdt@dah.test"]
        assert bureau.get(f"/api/v1/events/{event.pk}/reminders/").data == []

    def test_reserve_au_bureau(self, event, db):
        member = User.objects.create_user(email="m@dah.test", password="x", first_name="M", last_name="", role="membre")
        client = APIClient()
        client.force_authenticate(member)
        assert client.post(f"/api/v1/events/{event.pk}/remind/", {"subject": "S", "message": "M"}, format="json").status_code == 403


@pytest.mark.django_db
def test_donnees_des_inscrits_protegees(db):
    """Régression : get_permissions ouvrait ces actions à tout le monde."""
    from django.utils import timezone
    event = Event.objects.create(title="Public", description="d", event_type="meetup",
                                 start_date=timezone.now() + timezone.timedelta(days=3), is_published=True)
    p = event.participants.create(email="a@test.org", first_name="A", last_name="B", nationality="CI",
                                  organisation="o", profession="p", motivation="m")
    anonymous = APIClient()
    member = APIClient()
    member.force_authenticate(User.objects.create_user(email="m2@dah.test", password="x", first_name="M", last_name="", role="membre"))
    for client in (anonymous, member):
        assert client.get(f"/api/v1/events/{event.pk}/participants/").status_code in (401, 403)
        assert client.get(f"/api/v1/events/{event.pk}/export/").status_code in (401, 403)
        assert client.post(f"/api/v1/events/{event.pk}/validate/{p.pk}/").status_code in (401, 403)
    # L'inscription publique et la consultation restent ouvertes.
    assert anonymous.get(f"/api/v1/events/{event.pk}/").status_code == 200
    assert anonymous.get("/api/v1/events/").status_code == 200
    r = anonymous.post(f"/api/v1/events/{event.pk}/register/", {
        "email": "new@test.org", "first_name": "N", "last_name": "P", "nationality": "SN",
        "organisation": "o", "profession": "p", "motivation": "m",
    }, format="json")
    assert r.status_code in (200, 201), r.data


@pytest.mark.django_db
class TestAllParticipants:
    @pytest.fixture
    def events(self):
        from datetime import datetime
        from django.utils import timezone

        def make(title, month):
            return Event.objects.create(title=title, description="d", event_type="meetup", is_published=True,
                                        start_date=timezone.make_aware(datetime(2026, month, 10, 9)))
        jan, mar, jun = make("Janvier", 1), make("Mars", 3), make("Juin", 6)
        for event, emails in ((jan, ["awa@x.org", "kofi@x.org"]), (mar, ["awa@x.org"]), (jun, ["sara@x.org", "AWA@x.org"])):
            for email in emails:
                event.participants.create(email=email, first_name=email[:4], last_name="Z", nationality="CI",
                                          organisation="o", profession="p", motivation="m")
        return jan, mar, jun

    def test_par_periode(self, bureau, events):
        r = bureau.get("/api/v1/events/participants/", {"date_from": "2026-01-01", "date_to": "2026-03-31"})
        assert r.status_code == 200
        assert sorted(p["event_title"] for p in r.data) == ["Janvier", "Janvier", "Mars"]

    def test_par_evenements_choisis(self, bureau, events):
        jan, _, jun = events
        r = bureau.get("/api/v1/events/participants/", {"events": f"{jan.pk},{jun.pk}"})
        assert len(r.data) == 4 and {p["event_title"] for p in r.data} == {"Janvier", "Juin"}

    def test_export_par_personne(self, bureau, events):
        import io

        import openpyxl
        r = bureau.get("/api/v1/events/participants/export/", {"group": "person"})
        assert r.status_code == 200
        sheet = openpyxl.load_workbook(io.BytesIO(r.content)).active
        rows = list(sheet.iter_rows(values_only=True))
        awa = next(row for row in rows[1:] if row[2].lower() == "awa@x.org")
        assert awa[7] == 3  # trois événements, quelle que soit la casse de l'email
        assert len(rows) == 1 + 3  # en-tête + 3 personnes

    def test_reserve_au_bureau(self, events, db):
        assert APIClient().get("/api/v1/events/participants/").status_code == 401
        assert APIClient().get("/api/v1/events/participants/export/").status_code == 401

    def test_filtres_invalides(self, bureau, events):
        assert bureau.get("/api/v1/events/participants/", {"events": "pas-un-id"}).status_code == 400
        assert bureau.get("/api/v1/events/participants/", {"date_from": "2026-05-01", "date_to": "2026-01-01"}).status_code == 400
