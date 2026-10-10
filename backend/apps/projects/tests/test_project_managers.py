"""Gestionnaires de projets, description riche et email d'affectation."""
from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework.test import APIClient

from apps.departments.models import Department, DepartmentMembership
from apps.projects.models import Project

User = get_user_model()


def make(email, first="T", **extra):
    return User.objects.create_user(email=email, password="x", first_name=first, last_name="U", role="membre", **extra)


def api(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@pytest.fixture
def setup(db, settings, monkeypatch):
    settings.BREVO_API_KEY = ""
    settings.EMAIL_REDIRECT_TO = []
    # Emails envoyés tout de suite (pas de thread).
    monkeypatch.setattr("apps.projects.notifications.fire_and_forget", lambda fn, *a, **k: fn(*a))
    lead = make("lead@exemple.org", first="Léa")
    delegate = make("delegate@exemple.org", first="Dina")
    member = make("member@exemple.org", first="Awa")
    outsider = make("out@exemple.org")
    dept = Department.objects.create(name="Data", lead=lead)
    for u in (delegate, member):
        DepartmentMembership.objects.create(department=dept, user=u, start_date=date(2026, 1, 1))
    other = Project.objects.create(title="Projet d'un autre", description="x", department=dept, owner=member)
    return dict(lead=lead, delegate=delegate, member=member, outsider=outsider, dept=dept, other=other)


def url(dept):
    return f"/api/v1/departments/{dept.id}/project-managers/"


@pytest.mark.django_db
def test_lead_designates_project_managers(setup):
    s = setup
    assert api(s["delegate"]).post(url(s["dept"]), {"user": s["member"].id}).status_code == 403
    assert api(s["lead"]).post(url(s["dept"]), {"user": s["outsider"].id}).status_code == 400  # hors département
    r = api(s["lead"]).post(url(s["dept"]), {"user": s["delegate"].id})
    assert r.status_code == 201 and r.data == [{"id": s["delegate"].id, "full_name": "Dina U"}]
    detail = api(s["delegate"]).get(f"/api/v1/departments/{s['dept'].id}/").data
    assert detail["can_manage_projects"] is True and detail["can_manage"] is False

    assert api(s["lead"]).delete(f"{url(s['dept'])}{s['delegate'].id}/").status_code == 204
    assert api(s["delegate"]).get(f"/api/v1/departments/{s['dept'].id}/").data["can_manage_projects"] is False


@pytest.mark.django_db
def test_project_manager_creates_projects_and_assigns_but_never_validates(setup):
    s = setup
    s["dept"].project_managers.add(s["delegate"])
    c = api(s["delegate"])
    r = c.post("/api/v1/projects/", {"title": "Site", "description": "d", "department": s["dept"].id}, format="json")
    assert r.status_code == 201, r.data
    # Gère aussi les projets créés par d'autres dans le département.
    t = c.post(f"/api/v1/projects/{s['other'].id}/tasks/", {"title": "Maquette", "assigned_to": s["member"].id}, format="json")
    assert t.status_code == 201, t.data
    # Ne valide jamais.
    api(s["member"]).post(f"/api/v1/projects/{s['other'].id}/tasks/{t.data['id']}/submit/", {"note": ""}, format="json")
    assert c.post(f"/api/v1/projects/{s['other'].id}/tasks/{t.data['id']}/validate/", {}, format="json").status_code == 403


@pytest.mark.django_db
def test_rights_lost_when_leaving_department(setup):
    s = setup
    s["dept"].project_managers.add(s["delegate"])
    DepartmentMembership.objects.filter(user=s["delegate"]).update(end_date=date(2026, 2, 1))
    r = api(s["delegate"]).post("/api/v1/projects/", {"title": "X", "description": "d", "department": s["dept"].id}, format="json")
    assert r.status_code == 400


@pytest.mark.django_db
def test_lead_manages_projects_he_does_not_own(setup):
    s = setup
    r = api(s["lead"]).post(f"/api/v1/projects/{s['other'].id}/tasks/", {"title": "Revue"}, format="json")
    assert r.status_code == 201
    assert api(s["lead"]).patch(f"/api/v1/projects/{s['other'].id}/", {"status": "active"}, format="json").status_code == 200


@pytest.mark.django_db
def test_rich_description_is_cleaned_and_assignee_is_emailed(setup):
    s = setup
    body = '<p>Faire la <strong>maquette</strong></p><ul><li><p>accueil</p></li></ul><script>alert(1)</script>'
    r = api(s["lead"]).post(f"/api/v1/projects/{s['other'].id}/tasks/",
                            {"title": "Maquette", "description": body, "assigned_to": s["member"].id,
                             "due_date": "2026-11-30"}, format="json")
    assert r.status_code == 201
    assert "<script" not in r.data["description"] and "<strong>maquette</strong>" in r.data["description"]

    assert len(mail.outbox) == 1
    sent = mail.outbox[0]
    assert sent.to == ["member@exemple.org"] and sent.subject == "Nouvelle tâche : Maquette"
    html = sent.alternatives[0][0]
    assert "Bonjour Awa," in html and "<strong>maquette</strong>" in html and "30/11/2026" in html
    assert f"/manage/departments/{s['dept'].id}?tab=tasks" in html


@pytest.mark.django_db
def test_email_only_on_new_assignee(setup):
    s = setup
    c = api(s["lead"])
    task = c.post(f"/api/v1/projects/{s['other'].id}/tasks/", {"title": "T"}, format="json").data
    assert mail.outbox == []  # personne d'affecté
    path = f"/api/v1/projects/{s['other'].id}/tasks/{task['id']}/"
    c.patch(path, {"assigned_to": s["member"].id}, format="json")
    c.patch(path, {"title": "T2"}, format="json")          # même personne : pas de nouvel email
    c.patch(path, {"assigned_to": s["lead"].id}, format="json")  # s'affecte soi-même : rien
    assert [m.to for m in mail.outbox] == [["member@exemple.org"]]
