"""Annuaire public : uniquement les membres qui l'ont choisi."""
import importlib

import pytest
from django.apps import apps as django_apps
from django.core import mail
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.members.models import MemberProfile


def member(email, role="membre", public=False, **kw):
    user = User.objects.create_user(email=email, password="x", first_name=email.split("@")[0].title(),
                                    last_name="U", role=role, **kw)
    profile, _ = MemberProfile.objects.get_or_create(user=user)
    profile.is_public = public
    profile.save()
    return profile


def slugs(response):
    data = response.data["results"] if isinstance(response.data, dict) else response.data
    return {p["slug"] for p in data}


@pytest.mark.django_db
def test_new_profiles_are_private():
    user = User.objects.create_user(email="new@exemple.org", password="x", first_name="N", last_name="U", role="membre")
    profile, _ = MemberProfile.objects.get_or_create(user=user)
    assert profile.is_public is False


@pytest.mark.django_db
def test_directory_shows_only_consenting_members():
    shown = member("awa@exemple.org", public=True)
    hidden = member("kofi@exemple.org", public=False)
    cand = member("cand@exemple.org", role="candidat", public=True)
    off = member("off@exemple.org", public=True, is_active=False)
    c = APIClient()
    assert slugs(c.get("/api/v1/members/public/")) == {shown.slug}
    for p in (hidden, cand, off):
        assert c.get(f"/api/v1/members/public/{p.slug}/").status_code == 404
    assert c.get(f"/api/v1/members/public/{shown.slug}/").status_code == 200


@pytest.mark.django_db
def test_member_turns_profile_on_and_off():
    profile = member("awa@exemple.org")
    c = APIClient()
    c.force_authenticate(profile.user)
    assert c.patch("/api/v1/members/me/profile/", {"is_public": True}, format="json").data["is_public"] is True
    assert profile.slug in slugs(APIClient().get("/api/v1/members/public/"))
    c.patch("/api/v1/members/me/profile/", {"is_public": False}, format="json")
    assert slugs(APIClient().get("/api/v1/members/public/")) == set()


@pytest.mark.django_db
def test_migration_hides_existing_profiles():
    migration = importlib.import_module("apps.members.migrations.0004_profiles_private_by_default")
    member("awa@exemple.org", public=True)
    migration.hide_all_profiles(django_apps, None)
    assert not MemberProfile.objects.filter(is_public=True).exists()


@pytest.mark.django_db
def test_invitation_once_per_member(settings):
    settings.BREVO_API_KEY = ""
    settings.EMAIL_REDIRECT_TO = []
    member("awa@exemple.org")
    member("kofi@exemple.org", role="responsable")
    member("pub@exemple.org", public=True)          # déjà public : pas d'invitation
    member("cand@exemple.org", role="candidat")     # pas membre : pas d'invitation

    call_command("invite_public_profiles", "--dry-run")
    assert mail.outbox == []
    call_command("invite_public_profiles")
    assert sorted(m.to[0] for m in mail.outbox) == ["awa@exemple.org", "kofi@exemple.org"]
    assert "/profile#visibilite" in mail.outbox[0].alternatives[0][0]
    call_command("invite_public_profiles")          # relance : aucun doublon
    assert len(mail.outbox) == 2


@pytest.mark.django_db
def test_invitation_respects_daily_quota(settings):
    settings.BREVO_API_KEY = ""
    settings.EMAIL_REDIRECT_TO = []
    settings.EMAIL_DAILY_QUOTA = 32                  # 30 gardés pour les envois automatiques
    for i in range(4):
        member(f"m{i}@exemple.org")
    call_command("invite_public_profiles")
    assert len(mail.outbox) == 2
    assert MemberProfile.objects.filter(public_invite_sent_at__isnull=True).count() == 2


@pytest.mark.django_db
def test_bureau_masque_sur_le_site_public(settings):
    member("awa@exemple.org", public=True)
    pres = member("pres@exemple.org", public=True, poste="president")
    c = APIClient()
    assert slugs(c.get("/api/v1/members/public/")) == {MemberProfile.objects.get(user__email="awa@exemple.org").slug}
    assert c.get(f"/api/v1/members/public/{pres.slug}/").status_code == 404
    settings.PUBLIC_SHOW_BUREAU = True
    assert pres.slug in slugs(c.get("/api/v1/members/public/"))
