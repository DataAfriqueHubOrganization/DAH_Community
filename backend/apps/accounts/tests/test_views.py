import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="merveille@dah.com", password="securepass123",
        first_name="Merveille", last_name="Houenagnon",
        email_verified=True,
    )


@pytest.fixture
def auth_client(client, user):
    response = client.post(reverse("auth-login"), {"email": user.email, "password": "securepass123"})
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return client


@pytest.mark.django_db
class TestNoSelfRegistration:
    def test_pas_d_inscription_libre(self, client):
        """On rejoint DAH par une candidature, jamais en créant un compte soi-même."""
        response = client.post("/api/v1/auth/register/", {
            "email": "new@dah.com", "first_name": "N", "last_name": "M",
            "password": "securepass123", "password_confirm": "securepass123",
        })
        assert response.status_code in (401, 404, 405)
        assert not User.objects.filter(email="new@dah.com").exists()


@pytest.mark.django_db
class TestLoginView:
    def test_login_success(self, client, user):
        response = client.post(reverse("auth-login"), {
            "email": user.email, "password": "securepass123",
        })
        assert response.status_code == 200
        assert "access" in response.data
        # Le jeton de rafraîchissement n'est jamais lisible en JavaScript : cookie httpOnly.
        assert "refresh" not in response.data
        cookie = response.cookies["refresh_token"]
        assert cookie["httponly"] and cookie["path"] == "/api/v1/auth/token/refresh/"
        assert response.data["user"]["role"] == "visiteur"

    def test_login_wrong_password(self, client, user):
        response = client.post(reverse("auth-login"), {
            "email": user.email, "password": "wrongpass",
        })
        assert response.status_code == 401


@pytest.mark.django_db
class TestMeView:
    def test_me_authenticated(self, auth_client, user):
        response = auth_client.get(reverse("auth-me"))
        assert response.status_code == 200
        assert response.data["email"] == user.email

    def test_me_unauthenticated(self, client):
        response = client.get(reverse("auth-me"))
        assert response.status_code == 401

    def test_me_update(self, auth_client):
        response = auth_client.patch(reverse("auth-me"), {"phone": "+22961000000"})
        assert response.status_code == 200
        assert response.data["phone"] == "+22961000000"
