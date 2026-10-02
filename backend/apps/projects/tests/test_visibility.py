from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.departments.models import Department, DepartmentMembership
from apps.projects.models import Project, ProjectTask

User = get_user_model()
URL = "/api/v1/projects/"


def make_user(email, **extra):
    return User.objects.create_user(email=email, password="pass12345", first_name="T", last_name="U", **extra)


@pytest.fixture
def setup(db):
    today = timezone.now().date()
    dept_a = Department.objects.create(name="Dept A")
    dept_b = Department.objects.create(name="Dept B")
    member_a = make_user("membre.a@dah.test", role="membre")
    DepartmentMembership.objects.create(department=dept_a, user=member_a, start_date=today - timedelta(days=10))
    project_a = Project.objects.create(title="Projet A", description="a", department=dept_a)
    project_b = Project.objects.create(title="Projet B", description="b", department=dept_b)
    ProjectTask.objects.create(project=project_b, title="Tâche B")
    return dict(today=today, dept_a=dept_a, dept_b=dept_b, member_a=member_a,
                project_a=project_a, project_b=project_b)


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def titles(response):
    data = response.data["results"] if isinstance(response.data, dict) else response.data
    return {p["title"] for p in data}


@pytest.mark.django_db
class TestProjectVisibility:
    def test_membre_ne_voit_que_son_departement(self, setup):
        response = client_for(setup["member_a"]).get(URL)
        assert response.status_code == 200
        assert titles(response) == {"Projet A"}

    def test_filtre_sur_un_autre_departement_vide(self, setup):
        response = client_for(setup["member_a"]).get(URL, {"department": setup["dept_b"].pk})
        assert titles(response) == set()

    def test_projet_et_taches_d_un_autre_departement_introuvables(self, setup):
        client = client_for(setup["member_a"])
        pk = setup["project_b"].pk
        assert client.get(f"{URL}{pk}/").status_code == 404
        assert client.get(f"{URL}{pk}/tasks/").status_code == 404

    def test_lead_voit_son_departement(self, setup):
        lead_b = make_user("lead.b@dah.test", role="responsable")
        setup["dept_b"].lead = lead_b
        setup["dept_b"].save()
        assert titles(client_for(lead_b).get(URL)) == {"Projet B"}

    def test_bureau_voit_tout(self, setup):
        president = make_user("president@dah.test", role="membre", poste="president")
        assert titles(client_for(president).get(URL)) == {"Projet A", "Projet B"}

    def test_porteur_garde_acces_a_son_projet(self, setup):
        setup["project_b"].owner = setup["member_a"]
        setup["project_b"].save()
        assert titles(client_for(setup["member_a"]).get(URL)) == {"Projet A", "Projet B"}

    def test_adhesion_terminee_retire_l_acces(self, setup):
        DepartmentMembership.objects.filter(user=setup["member_a"]).update(
            end_date=setup["today"] - timedelta(days=1)
        )
        assert titles(client_for(setup["member_a"]).get(URL)) == set()
