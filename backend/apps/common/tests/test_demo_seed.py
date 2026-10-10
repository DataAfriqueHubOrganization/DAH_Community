import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.events.models import Event

User = get_user_model()


@pytest.mark.django_db
def test_seed_refuses_public_password_on_server(monkeypatch):
    monkeypatch.setenv("ENV", "prod")
    monkeypatch.delenv("SEED_PASSWORD", raising=False)
    with pytest.raises(CommandError):
        call_command("seed_dah", "--users-only")
    assert not User.objects.exists()


@pytest.mark.django_db
def test_users_only_creates_accounts_with_seed_password(monkeypatch):
    monkeypatch.setenv("ENV", "prod")
    monkeypatch.setenv("SEED_PASSWORD", "Preprod-Secret-42")
    call_command("seed_dah", "--users-only")
    admin = User.objects.get(email="admin@dah.com")
    assert admin.check_password("Preprod-Secret-42")
    assert not admin.check_password("Dah@2024!")
    assert not Event.objects.exists()  # aucune donnée de contenu


@pytest.mark.django_db
def test_reset_passwords_changes_only_demo_accounts(monkeypatch):
    real = User.objects.create_user(email="vrai@exemple.org", password="Original-Pass-1")
    monkeypatch.delenv("SEED_PASSWORD", raising=False)
    call_command("seed_dah", "--users-only")  # local : mot de passe de développement
    assert User.objects.get(email="alice@dah.com").check_password("Dah@2024!")

    monkeypatch.setenv("SEED_PASSWORD", "Nouveau-Secret-7")
    call_command("seed_dah", "--users-only", "--reset-passwords")
    assert User.objects.get(email="alice@dah.com").check_password("Nouveau-Secret-7")
    real.refresh_from_db()
    assert real.check_password("Original-Pass-1")
