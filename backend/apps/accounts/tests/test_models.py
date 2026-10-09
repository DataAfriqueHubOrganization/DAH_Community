import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
class TestUserModel:
    def test_create_user(self):
        user = User.objects.create_user(
            email="test@dah.com", password="securepass123",
            first_name="Merveille", last_name="Test",
        )
        assert user.email == "test@dah.com"
        assert user.role == "visiteur"
        assert not user.email_verified
        assert user.check_password("securepass123")

    def test_full_name(self):
        user = User(first_name="Merveille", last_name="Houenagnon")
        assert user.full_name == "Merveille Houenagnon"

    def test_create_superuser(self):
        admin = User.objects.create_superuser(email="admin@dah.com", password="adminpass123")
        assert admin.role == "admin"
        assert admin.is_staff
        assert admin.is_superuser
        assert admin.email_verified

    def test_email_normalized(self):
        user = User.objects.create_user(
            email="Test@DAH.COM", password="pass123",
            first_name="X", last_name="Y",
        )
        assert user.email == "Test@dah.com"

    def test_has_section(self):
        # Plus d'accès automatique par poste : seulement les sections accordées.
        user = User(role="membre", poste="president")
        assert not user.has_section("events")
        user.sections = ["events"]
        assert user.has_section("events") and not user.has_section("treasury")
        user.role = "candidat"
        assert not user.has_section("events")  # jamais pour un non-membre
        user.role, user.is_active = "membre", False
        assert not user.has_section("events")  # ni pour un compte désactivé
        admin = User(role="admin")
        assert admin.has_section("treasury") and len(admin.granted_sections) == 8
