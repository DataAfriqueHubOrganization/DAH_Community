from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.departments.models import Department, DepartmentMembership

User = get_user_model()
URL = "/api/v1/departments/"


def make_user(email, **extra):
    return User.objects.create_user(email=email, password="pass12345", first_name="T", last_name="U", **extra)


def client_for(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client


def names(response):
    data = response.data["results"] if isinstance(response.data, dict) else response.data
    return {d["name"] for d in data}


@pytest.fixture
def setup(db):
    today = timezone.now().date()
    dept_a = Department.objects.create(name="Dept A")
    dept_b = Department.objects.create(name="Dept B")
    member_a = make_user("membre.a@dah.test", role="membre")
    DepartmentMembership.objects.create(department=dept_a, user=member_a, start_date=today - timedelta(days=5))
    return dict(dept_a=dept_a, dept_b=dept_b, member_a=member_a)


@pytest.mark.django_db
class TestDepartmentVisibility:
    def test_membre_ne_liste_que_son_departement(self, setup):
        assert names(client_for(setup["member_a"]).get(URL)) == {"Dept A"}

    def test_autre_departement_introuvable(self, setup):
        client = client_for(setup["member_a"])
        other = setup["dept_b"].pk
        assert client.get(f"{URL}{other}/").status_code == 404
        assert client.get(f"{URL}{other}/announcements/").status_code == 404
        assert client.get(f"{URL}{setup['dept_a'].pk}/").status_code == 200

    def test_lead_sans_adhesion_voit_son_departement(self, setup):
        lead = make_user("lead.b@dah.test", role="responsable")
        setup["dept_b"].co_lead = lead
        setup["dept_b"].save()
        assert names(client_for(lead).get(URL)) == {"Dept B"}

    def test_sans_departement_liste_vide(self, setup):
        assert names(client_for(make_user("seul@dah.test", role="membre")).get(URL)) == set()

    def test_bureau_voit_tout(self, setup):
        president = make_user("president@dah.test", role="membre", poste="president")
        assert names(client_for(president).get(URL)) == {"Dept A", "Dept B"}

    def test_liste_publique_sans_connexion(self, setup):
        response = client_for().get(f"{URL}public/")
        assert response.status_code == 200
        assert response.data == [
            {"id": setup["dept_a"].pk, "name": "Dept A"},
            {"id": setup["dept_b"].pk, "name": "Dept B"},
        ]
