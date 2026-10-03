from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.departments.models import Department, DepartmentMembership, DepartmentTask
from apps.engagement.models import Award, CheckIn, PointEntry
from apps.engagement.services import compute_task_points
from apps.members.models import MemberProfile
from apps.projects.models import Project, ProjectTask

User = get_user_model()

SCORES = {"participation": 4, "follow_up": 5, "quality": 4, "teamwork": 3, "initiative": 4}


def make_user(email, **extra):
    return User.objects.create_user(email=email, password="pass12345", first_name=email.split("@")[0], last_name="", **extra)


def api(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client


@pytest.fixture(autouse=True)
def no_background(monkeypatch):
    monkeypatch.setattr("apps.engagement.services.fire_and_forget", lambda *a, **k: None)
    monkeypatch.setattr("apps.departments.services.fire_and_forget", lambda *a, **k: None)


@pytest.fixture
def world(db):
    today = timezone.localdate()
    dept = Department.objects.create(name="Data Engineering")
    other = Department.objects.create(name="Formation")
    lead = make_user("lead@dah.test", role="responsable")
    dept.lead = lead
    dept.save()
    member = make_user("membre@dah.test", role="membre")
    idle = make_user("idle@dah.test", role="membre")
    for u in (member, idle):
        DepartmentMembership.objects.create(department=dept, user=u, start_date=today - timedelta(days=30))
    outsider = make_user("autre@dah.test", role="membre")
    DepartmentMembership.objects.create(department=other, user=outsider, start_date=today - timedelta(days=30))
    president = make_user("president@dah.test", role="membre", poste="president")
    project = Project.objects.create(title="Migration dbt", description="d", department=dept, owner=lead)
    return dict(today=today, dept=dept, other=other, lead=lead, member=member, idle=idle,
                outsider=outsider, president=president, project=project)


def new_task(world, **extra):
    data = dict(project=world["project"], title="Écrire les tests", assigned_to=world["member"], size="medium")
    data.update(extra)
    return ProjectTask.objects.create(**data)


def task_url(world, task, action=""):
    base = f"/api/v1/projects/{world['project'].pk}/tasks/{task.pk}/"
    return f"{base}{action}/" if action else base


# ── Barème ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBareme:
    def make(self, size="medium", due=None, submitted=None):
        task = ProjectTask(size=size, due_date=due)
        task.submitted_at = submitted
        return task

    def test_sans_echeance(self):
        assert compute_task_points(self.make("small"), False) == (5, None)
        assert compute_task_points(self.make("large"), False) == (20, None)

    def test_a_temps_et_en_retard(self):
        now = timezone.now()
        today = timezone.localdate(now)
        assert compute_task_points(self.make("medium", today, now), False) == (12, True)
        assert compute_task_points(self.make("medium", today - timedelta(days=1), now), False) == (8, False)

    def test_travail_remarquable(self):
        now = timezone.now()
        assert compute_task_points(self.make("medium", timezone.localdate(now), now), True) == (15, True)
        assert compute_task_points(self.make("large"), True) == (25, None)


# ── Cycle de validation ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestValidationCycle:
    def test_le_membre_ne_peut_pas_mettre_validee(self, world):
        task = new_task(world)
        response = api(world["member"]).patch(task_url(world, task), {"status": "done"}, format="json")
        assert response.status_code == 400

    def test_soumission_puis_validation_donne_des_points(self, world):
        task = new_task(world, due_date=world["today"] + timedelta(days=3))
        assert api(world["member"]).post(task_url(world, task, "submit"), {"note": "PR #12"}).status_code == 200
        task.refresh_from_db()
        assert task.status == "submitted" and task.submission_note == "PR #12"

        response = api(world["lead"]).post(task_url(world, task, "validate"), {"outstanding": False})
        assert response.status_code == 200
        assert response.data["status"] == "done"
        assert response.data["points_awarded"] == 12
        entry = PointEntry.objects.get(project_task=task)
        assert (entry.user, entry.points, entry.on_time, entry.department) == (world["member"], 12, True, world["dept"])

    def test_un_membre_ne_valide_pas(self, world):
        task = new_task(world, assigned_to=world["idle"], status="submitted", submitted_at=timezone.now())
        response = api(world["member"]).post(task_url(world, task, "validate"))
        assert response.status_code == 403

    def test_on_ne_valide_pas_sa_propre_tache(self, world):
        task = new_task(world, assigned_to=world["lead"])
        api(world["lead"]).post(task_url(world, task, "submit"))
        response = api(world["lead"]).post(task_url(world, task, "validate"))
        assert response.status_code == 403
        # Le bureau, lui, peut valider la tâche du responsable.
        assert api(world["president"]).post(task_url(world, task, "validate")).status_code == 200

    def test_validation_exige_une_soumission(self, world):
        task = new_task(world)
        assert api(world["lead"]).post(task_url(world, task, "validate")).status_code == 400

    def test_renvoi_puis_revalidation_points_une_seule_fois(self, world):
        task = new_task(world)
        member, lead = api(world["member"]), api(world["lead"])
        member.post(task_url(world, task, "submit"))
        assert lead.post(task_url(world, task, "return"), {"reason": ""}).status_code == 400
        response = lead.post(task_url(world, task, "return"), {"reason": "Ajouter la doc"})
        assert response.data["status"] == "in_progress"
        assert response.data["return_reason"] == "Ajouter la doc"
        assert not PointEntry.objects.filter(project_task=task).exists()

        member.post(task_url(world, task, "submit"))
        lead.post(task_url(world, task, "validate"))
        assert PointEntry.objects.filter(project_task=task).count() == 1

        # Tâche validée : statut verrouillé, pas de nouvelle validation possible.
        assert lead.patch(task_url(world, task), {"status": "in_progress"}, format="json").status_code == 400
        assert lead.post(task_url(world, task, "validate")).status_code == 400
        assert PointEntry.objects.filter(project_task=task).count() == 1

    def test_taches_de_departement(self, world):
        task = DepartmentTask.objects.create(
            department=world["dept"], title="Doc", assigned_to=world["member"], size="large",
        )
        base = f"/api/v1/departments/{world['dept'].pk}/tasks/{task.pk}"
        assert api(world["member"]).patch(f"{base}/", {"status": "done"}, format="json").status_code == 400
        assert api(world["member"]).post(f"{base}/submit/").status_code == 200
        response = api(world["lead"]).post(f"{base}/validate/", {"outstanding": True})
        assert response.status_code == 200
        assert PointEntry.objects.get(department_task=task).points == 25


# ── Classement & mes points ───────────────────────────────────────────────

def award_points(world, user, points, source=PointEntry.SOURCE_TASK, department=None, days_ago=0):
    return PointEntry.objects.create(
        user=user, points=points, source=source, label="x", department=department or world["dept"],
        awarded_at=timezone.now() - timedelta(days=days_ago), on_time=True if source == "task" else None,
    )


@pytest.mark.django_db
class TestRanking:
    URL = "/api/v1/engagement/ranking/"

    def test_reserve_aux_responsables_et_au_bureau(self, world):
        assert api(world["member"]).get(self.URL).status_code == 403

    def test_responsable_voit_son_departement_avec_les_membres_sans_points(self, world):
        award_points(world, world["member"], 12)
        award_points(world, world["outsider"], 50, department=world["other"])
        response = api(world["lead"]).get(self.URL, {"period": "month"})
        assert response.status_code == 200
        assert response.data["department"]["id"] == world["dept"].pk
        totals = {row["full_name"]: row["total"] for row in response.data["rows"]}
        assert totals["membre"] == 12 and totals["idle"] == 0 and "autre" not in totals
        assert response.data["awards"] == []  # réservé au bureau
        # Pas de classement d'un autre département
        assert api(world["lead"]).get(self.URL, {"department": world["other"].pk}).status_code == 403

    def test_bureau_classement_global_avec_ex_aequo(self, world):
        award_points(world, world["member"], 10)
        award_points(world, world["idle"], 10)
        award_points(world, world["outsider"], 30, department=world["other"])
        award_points(world, world["outsider"], 99, days_ago=400)  # hors période
        rows = api(world["president"]).get(self.URL, {"period": "year"}).data["rows"]
        assert [(r["full_name"], r["total"], r["rank"]) for r in rows] == [
            ("autre", 30, 1), ("idle", 10, 2), ("membre", 10, 2),
        ]

    def test_mes_points_sans_classement(self, world):
        award_points(world, world["member"], 12)
        award_points(world, world["member"], 16, source=PointEntry.SOURCE_CHECKIN)
        award_points(world, world["idle"], 40)
        data = api(world["member"]).get("/api/v1/engagement/me/", {"period": "month"}).data
        assert data["total"] == 28
        assert len(data["entries"]) == 2
        assert "rows" not in data and "rank" not in data
        assert sum(m["total"] for m in data["monthly"]) == 28


# ── Points d'étape ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCheckIn:
    URL = "/api/v1/engagement/checkins/"

    def launch(self, world, members=None):
        return api(world["lead"]).post(self.URL, {
            "department": world["dept"].pk, "members": members or [], "month": world["today"].isoformat(),
        }, format="json")

    def test_parcours_complet(self, world):
        response = self.launch(world)
        assert response.status_code == 201 and response.data["created"] == 2  # membre + idle
        # Pas de doublon tant qu'un point d'étape est ouvert
        assert self.launch(world).data["created"] == 0

        checkin = CheckIn.objects.get(member=world["member"])
        member = api(world["member"])
        url = f"{self.URL}{checkin.pk}/"

        # Le responsable ne peut pas confirmer avant la réponse du membre
        assert api(world["lead"]).post(f"{url}confirm/", {"final_scores": SCORES, "feedback": "ok"}, format="json").status_code == 400

        assert member.post(f"{url}submit/", {
            "self_scores": SCORES, "improve_self": "Être plus régulier", "department_help": "Plus de points d'équipe",
        }, format="json").status_code == 200

        final = {**SCORES, "teamwork": 5}  # 4+5+4+5+4 = 22 / 5 = 4.4 → 17.6 → 18 points
        response = api(world["lead"]).post(f"{url}confirm/", {
            "final_scores": final, "feedback": "Merci pour ton implication.",
        }, format="json")
        assert response.status_code == 200
        assert response.data["points"] == 18 and response.data["viewer"] == "manager"
        entry = PointEntry.objects.get(checkin=checkin)
        assert (entry.user, entry.points, entry.source) == (world["member"], 18, "checkin")

        # Le membre ne voit que le retour écrit
        seen = member.get(url).data
        assert seen["feedback"] == "Merci pour ton implication."
        assert "final_scores" not in seen and "points" not in seen
        # Pas de seconde confirmation
        assert api(world["lead"]).post(f"{url}confirm/", {"final_scores": final, "feedback": "x"}, format="json").status_code == 400

    def test_acces(self, world):
        self.launch(world, [world["member"].pk])
        checkin = CheckIn.objects.get(member=world["member"])
        assert api(world["idle"]).get(f"{self.URL}{checkin.pk}/").status_code == 403
        assert api(world["member"]).get(self.URL, {"department": world["dept"].pk}).status_code == 403
        # Un responsable ne lance pas pour un autre département
        response = api(world["lead"]).post(self.URL, {
            "department": world["other"].pk, "month": world["today"].isoformat(),
        }, format="json")
        assert response.status_code == 403

    def test_scores_valides(self, world):
        self.launch(world, [world["member"].pk])
        checkin = CheckIn.objects.get(member=world["member"])
        response = api(world["member"]).post(f"{self.URL}{checkin.pk}/submit/", {
            "self_scores": {**SCORES, "quality": 9}, "improve_self": "", "department_help": "",
        }, format="json")
        assert response.status_code == 400


# ── Distinctions & ajustements ────────────────────────────────────────────

@pytest.mark.django_db
class TestAwardsAndAdjustments:
    def test_membre_du_mois(self, world):
        MemberProfile.objects.get_or_create(user=world["member"], defaults={"slug": "membre-x"})
        bureau = api(world["president"])
        today = world["today"].isoformat()
        assert api(world["lead"]).post("/api/v1/engagement/awards/", {"user": world["member"].pk, "kind": "month", "date": today}).status_code == 403

        assert bureau.post("/api/v1/engagement/awards/", {"user": world["idle"].pk, "kind": "month", "date": today}).status_code == 201
        # Nouvelle désignation pour le même mois : remplace la précédente
        assert bureau.post("/api/v1/engagement/awards/", {"user": world["member"].pk, "kind": "month", "date": today}).status_code == 201
        assert Award.objects.filter(kind="month").count() == 1
        assert Award.objects.get(kind="month").user == world["member"]

        slug = MemberProfile.objects.get(user=world["member"]).slug
        profile = api().get(f"/api/v1/members/public/{slug}/")
        assert profile.status_code == 200
        assert profile.data["awards"][0]["kind"] == "month"

    def test_ajustement(self, world):
        url = "/api/v1/engagement/adjustments/"
        assert api(world["lead"]).post(url, {"user": world["member"].pk, "points": 5, "reason": "x"}).status_code == 403
        assert api(world["president"]).post(url, {"user": world["member"].pk, "points": 5, "reason": " "}).status_code == 400
        assert api(world["president"]).post(url, {"user": world["member"].pk, "points": -3, "reason": "Doublon"}).status_code == 201
        assert PointEntry.objects.get(source="adjustment").points == -3


# ── Règles de date du classement mensuel ──────────────────────────────────

@pytest.mark.django_db
class TestMonthlyRules:
    def test_tache_comptee_au_mois_de_soumission(self, world):
        submitted = timezone.now() - timedelta(days=40)
        task = new_task(world, status="submitted", submitted_at=submitted)
        api(world["lead"]).post(task_url(world, task, "validate"))
        entry = PointEntry.objects.get(project_task=task)
        assert timezone.localdate(entry.awarded_at) == timezone.localdate(submitted)

    def test_point_d_etape_compte_dans_le_mois_evalue(self, world):
        last_month = (world["today"].replace(day=1) - timedelta(days=1)).replace(day=1)
        response = api(world["lead"]).post("/api/v1/engagement/checkins/", {
            "department": world["dept"].pk, "members": [world["member"].pk], "month": last_month.isoformat(),
        }, format="json")
        assert response.data["created"] == 1
        checkin = CheckIn.objects.get(member=world["member"])
        assert checkin.period_start == last_month
        url = f"/api/v1/engagement/checkins/{checkin.pk}/"
        api(world["member"]).post(f"{url}submit/", {"self_scores": SCORES, "improve_self": "", "department_help": ""}, format="json")
        api(world["lead"]).post(f"{url}confirm/", {"final_scores": SCORES, "feedback": "Merci"}, format="json")
        # Confirmé ce mois-ci, mais compté le mois évalué
        entry = PointEntry.objects.get(checkin=checkin)
        assert timezone.localdate(entry.awarded_at).replace(day=1) == last_month
        # Un seul point d'étape par membre et par mois
        again = api(world["lead"]).post("/api/v1/engagement/checkins/", {
            "department": world["dept"].pk, "members": [world["member"].pk], "month": last_month.isoformat(),
        }, format="json")
        assert again.data["created"] == 0

    def test_pas_de_point_d_etape_pour_un_mois_futur(self, world):
        future = (world["today"].replace(day=28) + timedelta(days=10)).isoformat()
        response = api(world["lead"]).post("/api/v1/engagement/checkins/", {
            "department": world["dept"].pk, "month": future,
        }, format="json")
        assert response.status_code == 400

    def test_meilleur_par_departement_dans_la_vue_communaute(self, world):
        award_points(world, world["member"], 12)
        award_points(world, world["idle"], 5)
        award_points(world, world["outsider"], 30, department=world["other"])
        data = api(world["president"]).get("/api/v1/engagement/ranking/", {"period": "month"}).data
        leaders = {l["department_name"]: (l["full_name"], l["total"]) for l in data["department_leaders"]}
        assert leaders == {"Data Engineering": ("membre", 12), "Formation": ("autre", 30)}
        # Pas de « meilleurs par département » dans la vue d'un département
        dept_view = api(world["lead"]).get("/api/v1/engagement/ranking/", {"period": "month"}).data
        assert dept_view["department_leaders"] == []


@pytest.mark.django_db
class TestDepartmentWorkspace:
    def test_relance_des_points_d_etape_a_remplir(self, world, monkeypatch):
        sent = []
        monkeypatch.setattr("apps.engagement.services.fire_and_forget", lambda fn, *a, **k: sent.append(a))
        month = world["today"].replace(day=1).isoformat()
        api(world["lead"]).post("/api/v1/engagement/checkins/", {
            "department": world["dept"].pk, "members": [], "month": month,
        }, format="json")
        CheckIn.objects.filter(member=world["member"]).update(status=CheckIn.STATUS_SUBMITTED)
        sent.clear()

        r = api(world["lead"]).post("/api/v1/engagement/checkins/remind/", {
            "department": world["dept"].pk, "month": month,
        }, format="json")
        assert r.status_code == 200
        assert r.data["reminded"] == 1  # seul « idle » n'a pas rempli
        assert sent == [(CheckIn.objects.get(member=world["idle"]).pk, True)]

        r = api(world["member"]).post("/api/v1/engagement/checkins/remind/", {
            "department": world["dept"].pk, "month": month,
        }, format="json")
        assert r.status_code == 403

    def test_taches_du_departement_reservees_au_departement(self, world):
        new_task(world)
        url = f"/api/v1/projects/department-tasks/?department={world['dept'].pk}"
        r = api(world["lead"]).get(url)
        assert r.status_code == 200
        assert [t["title"] for t in r.data] == ["Écrire les tests"]
        assert api(world["member"]).get(url).status_code == 200
        assert api(world["outsider"]).get(url).status_code == 403
        assert api(world["president"]).get(url).status_code == 200
