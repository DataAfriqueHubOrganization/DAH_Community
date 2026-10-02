import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@pytest.fixture
def no_verification_email(monkeypatch):
    """Échoue si un email de vérification est envoyé."""
    def fail(*args, **kwargs):
        raise AssertionError("aucun email de vérification ne doit être envoyé")
    monkeypatch.setattr("apps.accounts.services.send_verification_email_async", fail)


@pytest.mark.django_db
class TestFirstLoginActivation:
    def test_premiere_connexion_active_le_compte(self, no_verification_email):
        user = User.objects.create_user(
            email="nouveau@dah.test", password="TempPass123!", first_name="N", last_name="M", role="membre",
        )
        assert user.email_verified is False

        response = APIClient().post(reverse("auth-login"), {"email": user.email, "password": "TempPass123!"})

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.email_verified is True
        assert response.data["user"]["email_verified"] is True
        # Le token reflète déjà le nouveau statut
        assert AccessToken(response.data["access"])["email_verified"] is True

    def test_mauvais_mot_de_passe_n_active_pas(self, no_verification_email):
        user = User.objects.create_user(
            email="nouveau@dah.test", password="TempPass123!", first_name="N", last_name="M",
        )
        response = APIClient().post(reverse("auth-login"), {"email": user.email, "password": "faux"})

        assert response.status_code == 401
        user.refresh_from_db()
        assert user.email_verified is False

    def test_acceptation_candidature_sans_email_de_verification(self, no_verification_email, monkeypatch):
        from apps.memberships.models import Candidature
        from apps.memberships.services import accept_candidature

        monkeypatch.setattr("apps.memberships.services.fire_and_forget", lambda *a, **k: None)
        reviewer = User.objects.create_user(email="admin@dah.test", password="x", role="admin")
        candidature = Candidature.objects.create(
            first_name="Awa", last_name="Diop", email="awa@dah.test",
            country="Sénégal", profession="Data Analyst", motivation="x" * 60,
        )

        accept_candidature(candidature, reviewer)

        user = User.objects.get(email="awa@dah.test")
        assert user.email_verified is False  # sera activé à la première connexion
