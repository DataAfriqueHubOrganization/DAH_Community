import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient

from apps.memberships.models import Candidature


@pytest.fixture
def client(monkeypatch):
    # Pas d'envoi d'email réel pendant les tests (tâches lancées en arrière-plan).
    monkeypatch.setattr("apps.memberships.views.fire_and_forget", lambda *a, **k: None)
    return APIClient()


def payload(**overrides):
    data = {
        "first_name": "Awa",
        "last_name": "Diop",
        "email": "awa@example.com",
        "country": "Sénégal",
        "profession": "Data Analyst",
        "motivation": "x" * 60,
        "engagements": ["training"],
    }
    data.update(overrides)
    return data


@pytest.mark.django_db
class TestCandidatureEngagements:
    def test_engagement_requis(self, client):
        response = client.post(reverse("candidature-create"), payload(engagements=[]), format="json")
        assert response.status_code == 400
        assert "engagements" in response.data["detail"]

    def test_choix_inconnu_refuse(self, client):
        response = client.post(reverse("candidature-create"), payload(engagements=["autre"]), format="json")
        assert response.status_code == 400

    def test_benevolat_exige_un_pole(self, client):
        response = client.post(reverse("candidature-create"), payload(engagements=["volunteer"]), format="json")
        assert response.status_code == 400
        assert "volunteer_poles" in response.data["detail"]

    def test_benevolat_avec_poles(self, client):
        response = client.post(
            reverse("candidature-create"),
            payload(engagements=["news", "volunteer", "news"], volunteer_poles=["labs", "data_tour"]),
            format="json",
        )
        assert response.status_code == 201
        c = Candidature.objects.get(email="awa@example.com")
        # Dédoublonné et remis dans l'ordre d'affichage des choix
        assert c.engagements == ["volunteer", "news"]
        assert c.volunteer_poles == ["data_tour", "labs"]
        assert c.get_volunteer_poles_display() == ["Data Tour", "DAH Labs"]

    def test_poles_ignores_sans_benevolat(self, client):
        response = client.post(
            reverse("candidature-create"),
            payload(engagements=["training"], volunteer_poles=["media"]),
            format="json",
        )
        assert response.status_code == 201
        assert Candidature.objects.get(email="awa@example.com").volunteer_poles == []

    def test_envoi_multipart_avec_cv(self, client):
        # Avec un CV, le frontend envoie un FormData : les listes arrivent en clés répétées.
        cv = SimpleUploadedFile("cv.pdf", b"%PDF-1.4 test", content_type="application/pdf")
        response = client.post(
            reverse("candidature-create"),
            {**payload(engagements=["volunteer", "expertise"], volunteer_poles=["academy", "media"]), "cv": cv},
            format="multipart",
        )
        assert response.status_code == 201, response.data
        c = Candidature.objects.get(email="awa@example.com")
        assert c.engagements == ["volunteer", "expertise"]
        assert c.volunteer_poles == ["academy", "media"]
