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

    def test_is_bureau(self):
        # Le bureau = un poste (président, trésorier…) ou le rôle admin.
        user = User(role="membre", poste="president")
        assert user.is_bureau
        user.poste = None
        assert not user.is_bureau
        user.role = "admin"
        assert user.is_bureau
