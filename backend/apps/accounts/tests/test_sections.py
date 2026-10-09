"""Gestion des accès par section : l'admin a tout, les autres ce qui leur est accordé."""
import importlib

import pytest
from django.apps import apps as django_apps
from rest_framework.test import APIClient

from apps.accounts.models import SECTIONS, User, users_with_section


def make(email, **kw):
    return User.objects.create_user(email=email, password="x", first_name="T", last_name="U", **kw)


def api(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@pytest.mark.django_db
def test_poste_alone_gives_no_access_anymore():
    president = make("pdt@exemple.org", role="membre", poste="president")
    assert api(president).get("/api/v1/events/participants/").status_code == 403
    assert api(president).get("/api/v1/memberships/candidatures/list/").status_code == 403
    assert api(president).get("/api/v1/auth/me/").data["sections"] == []


@pytest.mark.django_db
def test_granted_section_opens_only_that_section():
    alice = make("alice@exemple.org", role="membre", sections=[SECTIONS.EVENTS])
    assert api(alice).get("/api/v1/events/participants/").status_code == 200
    assert api(alice).get("/api/v1/mailing/emails/").status_code == 403
    assert api(alice).get("/api/v1/auth/me/").data["sections"] == ["events"]


@pytest.mark.django_db
def test_admin_has_everything():
    admin = make("admin@exemple.org", role="admin")
    assert api(admin).get("/api/v1/auth/me/").data["sections"] == SECTIONS.KEYS


@pytest.mark.django_db
def test_admin_grants_and_revokes_sections():
    admin = make("admin@exemple.org", role="admin")
    bob = make("bob@exemple.org", role="membre")
    url = f"/api/v1/auth/users/{bob.id}/"
    r = api(admin).patch(url, {"sections": ["treasury", "events", "events"]}, format="json")
    assert r.status_code == 200 and r.data["sections"] == ["events", "treasury"]
    assert api(admin).patch(url, {"sections": ["unknown"]}, format="json").status_code == 400
    assert api(admin).patch(url, {"sections": []}, format="json").data["sections"] == []

    # Seul l'admin accorde des accès, même avec toutes les sections.
    bob.sections = SECTIONS.KEYS
    bob.save()
    assert api(bob).patch(url, {"sections": ["emails"]}, format="json").status_code == 403


@pytest.mark.django_db
def test_no_access_for_non_members():
    admin = make("admin@exemple.org", role="admin")
    cand = make("cand@exemple.org", role="candidat")
    r = api(admin).patch(f"/api/v1/auth/users/{cand.id}/", {"sections": ["events"]}, format="json")
    assert r.status_code == 400
    # Un membre repassé candidat perd ses accès.
    m = make("m@exemple.org", role="membre", sections=["events"])
    api(admin).patch(f"/api/v1/auth/users/{m.id}/", {"role": "candidat"}, format="json")
    m.refresh_from_db()
    assert m.sections == []


@pytest.mark.django_db
def test_notification_recipients_follow_sections():
    make("admin@exemple.org", role="admin")
    make("tres@exemple.org", role="membre", poste="tresorier")          # poste sans la section
    make("bob@exemple.org", role="membre", sections=["treasury"])
    make("off@exemple.org", role="membre", sections=["treasury"], is_active=False)
    assert sorted(users_with_section("treasury").values_list("email", flat=True)) == [
        "admin@exemple.org", "bob@exemple.org"]


@pytest.mark.django_db
def test_migration_keeps_current_access():
    migration = importlib.import_module("apps.accounts.migrations.0004_user_sections")
    sg = make("sg@exemple.org", role="membre", poste="secretaire_general")
    tres = make("tres@exemple.org", role="responsable", poste="tresorier")
    pdt = make("pdt@exemple.org", role="membre", poste="president")
    member = make("m@exemple.org", role="membre")
    migration.grant_current_access(django_apps, None)
    for u in (sg, tres, pdt, member):
        u.refresh_from_db()
    assert sg.sections == migration.BUREAU
    assert tres.sections == migration.BUREAU + ["treasury"]
    assert pdt.sections == migration.BUREAU + ["applications"]
    assert member.sections == []
