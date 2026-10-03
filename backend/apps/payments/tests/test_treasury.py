from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.departments.models import Department, DepartmentMembership
from apps.engagement.models import PointEntry
from apps.engagement.services import build_ranking
from apps.members.models import MemberProfile
from apps.payments import services
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.payments.models import CashEntry, Contribution, ContributionMonth, ContributionReminder, PaymentDeclaration

User = get_user_model()


def make_user(email, joined: date, **extra):
    user = User.objects.create_user(email=email, password="pass12345", first_name=email.split("@")[0], last_name="", **extra)
    profile, _ = MemberProfile.objects.get_or_create(user=user)
    MemberProfile.objects.filter(pk=profile.pk).update(
        created_at=timezone.make_aware(timezone.datetime(joined.year, joined.month, joined.day, 12)),
    )
    user.refresh_from_db()
    return user


def api(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client


@pytest.fixture(autouse=True)
def no_background(monkeypatch):
    monkeypatch.setattr("apps.payments.services.fire_and_forget", lambda *a, **k: None)


@pytest.fixture
def world(db):
    today = timezone.localdate()
    year_start = date(today.year, 1, 1)
    treasurer = make_user("tresor@dah.test", year_start, role="membre", poste="tresorier")
    deputy = make_user("adjoint@dah.test", year_start, role="membre", poste="tresorier_adj")
    admin = make_user("admin@dah.test", year_start, role="admin")
    member = make_user("membre@dah.test", year_start, role="membre")
    lead = make_user("lead@dah.test", year_start, role="membre")
    president = make_user("pdt@dah.test", year_start, role="membre", poste="president")
    visitor = make_user("visiteur@dah.test", year_start, role="visiteur")
    dept = Department.objects.create(name="Data Engineering", lead=lead)
    DepartmentMembership.objects.create(department=dept, user=member, start_date=year_start)
    return dict(today=today, treasurer=treasurer, deputy=deputy, admin=admin, member=member,
                lead=lead, president=president, visitor=visitor, dept=dept)


def pay(world, who, start, months, by="treasurer"):
    return api(world[by]).post("/api/v1/payments/contributions/", {
        "user": world[who].pk, "period_start": start.strftime("%Y-%m"), "months": months,
        "paid_on": world["today"].isoformat(), "method": "mobile_money",
    }, format="json")


@pytest.mark.django_db
class TestRates:
    def test_tarifs(self, world):
        assert services.monthly_rate(world["member"]) == 500
        assert services.monthly_rate(world["lead"]) == 1000       # responsable de département
        assert services.monthly_rate(world["president"]) == 1000  # bureau
        assert services.monthly_rate(world["treasurer"]) == 1000

    def test_qui_cotise(self, world):
        assert services.is_liable(world["member"])
        assert not services.is_liable(world["visitor"])
        assert not services.is_liable(world["admin"])  # compte technique sans poste


@pytest.mark.django_db
class TestRecordContribution:
    def test_paiement_en_bloc_points_et_caisse(self, world):
        start = date(world["today"].year, 1, 1)
        r = pay(world, "member", start, 3)
        assert r.status_code == 201, r.data
        assert r.data["amount"] == 1500 and r.data["points"] == 15
        months = list(ContributionMonth.objects.filter(user=world["member"]).values_list("month", flat=True))
        assert months == [date(start.year, m, 1) for m in (1, 2, 3)]
        # 5 pts par mois couvert, comptés dans le mois couvert
        entries = PointEntry.objects.filter(user=world["member"], source="contribution").order_by("awarded_at")
        assert [e.points for e in entries] == [5, 5, 5]
        assert [timezone.localtime(e.awarded_at).month for e in entries] == [1, 2, 3]
        assert entries[0].department == world["dept"]
        # ligne de caisse automatique
        cash = CashEntry.objects.get(contribution__user=world["member"])
        assert cash.kind == "income" and cash.category == "contributions" and cash.amount == 1500

    def test_un_mois_ne_se_paie_qu_une_fois(self, world):
        start = date(world["today"].year, 1, 1)
        assert pay(world, "member", start, 2).status_code == 201
        r = pay(world, "member", date(start.year, 2, 1), 2)
        assert r.status_code == 400
        assert ContributionMonth.objects.filter(user=world["member"]).count() == 2

    def test_pas_avant_l_adhesion(self, world):
        r = pay(world, "member", date(world["today"].year - 1, 12, 1), 1)
        assert r.status_code == 400

    def test_reserve_a_la_tresorerie(self, world):
        start = date(world["today"].year, 1, 1)
        assert pay(world, "member", start, 1, by="deputy").status_code == 201
        assert pay(world, "lead", start, 1, by="admin").status_code == 201
        assert pay(world, "member", date(start.year, 2, 1), 1, by="president").status_code == 403
        assert pay(world, "member", date(start.year, 2, 1), 1, by="member").status_code == 403

    def test_annulation_retire_mois_points_et_caisse(self, world):
        r = pay(world, "member", date(world["today"].year, 1, 1), 2)
        assert api(world["treasurer"]).delete(f"/api/v1/payments/contributions/{r.data['id']}/").status_code == 204
        assert not ContributionMonth.objects.exists()
        assert not PointEntry.objects.filter(source="contribution").exists()
        assert not CashEntry.objects.exists()

    def test_points_dans_le_classement(self, world):
        pay(world, "member", date(world["today"].year, 1, 1), 1)
        jan = date(world["today"].year, 1, 1)
        rows = build_ranking(jan, date(jan.year, 2, 1))
        row = next(r for r in rows if r["user_id"] == world["member"].id)
        assert row["contribution_points"] == 5 and row["total"] == 5


@pytest.mark.django_db
class TestSituation:
    def test_retard_mois_en_cours_et_reste_du(self, world):
        today = date(2026, 10, 3)
        member = world["member"]
        Contribution.objects.all().delete()
        situation = services.member_situation(member, 2026, paid_months={date(2026, m, 1): 500 for m in range(1, 9)}, today=today)
        statuses = [m["status"] for m in situation["months"]]
        assert statuses[:8] == ["paid"] * 8
        assert statuses[8] == "late"      # septembre terminé, non réglé
        assert statuses[9] == "due"       # octobre en cours
        assert statuses[10:] == ["upcoming", "upcoming"]
        assert situation["owed"] == 1000
        assert situation["paid_until"] == date(2026, 8, 1)
        assert situation["status"] == "late"
        assert situation["next_unpaid"] == date(2026, 9, 1)

    def test_mois_avant_adhesion_non_dus(self, world):
        member = make_user("nouveau@dah.test", date(2026, 6, 10), role="membre")
        situation = services.member_situation(member, 2026, paid_months={}, today=date(2026, 7, 2))
        statuses = [m["status"] for m in situation["months"]]
        assert statuses[:5] == ["not_due"] * 5
        assert statuses[5] == "late" and statuses[6] == "due"
        assert situation["status"] == "never_paid"

    def test_vue_membre(self, world):
        pay(world, "member", date(world["today"].year, 1, 1), 1)
        r = api(world["member"]).get("/api/v1/payments/me/")
        assert r.status_code == 200 and r.data["liable"] is True
        assert r.data["rate"] == 500
        # Pas de récapitulatif ni de détail des paiements côté membre
        assert "history" not in r.data and "paid_in_year" not in r.data
        assert r.data["months"][0]["status"] == "paid"
        assert api(world["visitor"]).get("/api/v1/payments/me/").data == {"liable": False}

    def test_tableau_tresorier(self, world):
        r = api(world["treasurer"]).get("/api/v1/payments/contributions/")
        assert r.status_code == 200
        names = {row["full_name"] for row in r.data["rows"]}
        assert "membre" in names and "visiteur" not in names
        assert api(world["member"]).get("/api/v1/payments/contributions/").status_code == 403


@pytest.mark.django_db
class TestCash:
    def test_journal_et_bilan(self, world):
        client = api(world["treasurer"])
        r = client.post("/api/v1/payments/cash/", {
            "kind": "expense", "category": "events", "label": "Location salle", "amount": 85000,
            "date": world["today"].isoformat(), "method": "transfer",
        }, format="json")
        assert r.status_code == 201, r.data
        client.post("/api/v1/payments/cash/", {
            "kind": "income", "category": "sponsorship", "label": "Sponsor", "amount": 150000,
            "date": world["today"].isoformat(), "method": "transfer",
        }, format="json")
        summary = client.get("/api/v1/payments/cash/summary/").data
        assert summary["balance"] == 65000 and summary["income"] == 150000 and summary["expense"] == 85000
        export = client.get("/api/v1/payments/cash/export/")
        assert export.status_code == 200 and "Location salle" in export.content.decode("utf-8")

    def test_categorie_coherente_et_cotisations_protegees(self, world):
        client = api(world["treasurer"])
        r = client.post("/api/v1/payments/cash/", {
            "kind": "income", "category": "events", "label": "x", "amount": 10, "date": world["today"].isoformat(),
        }, format="json")
        assert r.status_code == 400
        pay(world, "member", date(world["today"].year, 1, 1), 1)
        entry = CashEntry.objects.get(category="contributions")
        assert client.delete(f"/api/v1/payments/cash/{entry.pk}/").status_code == 403

    def test_caisse_reservee(self, world):
        assert api(world["member"]).get("/api/v1/payments/cash/").status_code == 403
        assert api(world["president"]).get("/api/v1/payments/cash/summary/").status_code == 403


def png():
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), "#2F6FE0").save(buffer, format="PNG")
    return SimpleUploadedFile("preuve.png", buffer.getvalue(), content_type="image/png")


def declare(world, who="member", start=None, months=1):
    start = start or date(world["today"].year, 1, 1)
    return api(world[who]).post("/api/v1/payments/declarations/", {
        "period_start": start.strftime("%Y-%m"), "months": months, "method": "mobile_money",
        "reference": "OM-1", "proof": png(),
    }, format="multipart")


@pytest.mark.django_db
class TestDeclarations:
    def test_declaration_puis_validation(self, world):
        r = declare(world, months=2)
        assert r.status_code == 201, r.data
        assert r.data["status"] == "pending" and r.data["amount"] == 1000
        # Mois en attente côté membre, pas encore de points
        me = api(world["member"]).get("/api/v1/payments/me/").data
        assert [m["status"] for m in me["months"][:2]] == ["pending", "pending"]
        assert not PointEntry.objects.filter(user=world["member"]).exists()
        # Pas deux déclarations pour le même mois
        assert declare(world, months=1).status_code == 400

        assert api(world["member"]).post(f"/api/v1/payments/declarations/{r.data['id']}/approve/").status_code == 403
        ok = api(world["treasurer"]).post(f"/api/v1/payments/declarations/{r.data['id']}/approve/")
        assert ok.status_code == 200 and ok.data["status"] == "approved"
        assert ContributionMonth.objects.filter(user=world["member"]).count() == 2
        assert PointEntry.objects.filter(user=world["member"], source="contribution").count() == 2
        # Déjà traitée
        assert api(world["treasurer"]).post(f"/api/v1/payments/declarations/{r.data['id']}/approve/").status_code == 400

    def test_refus_avec_motif(self, world):
        r = declare(world)
        bad = api(world["treasurer"]).post(f"/api/v1/payments/declarations/{r.data['id']}/reject/", {}, format="json")
        assert bad.status_code == 400  # motif obligatoire
        ok = api(world["treasurer"]).post(f"/api/v1/payments/declarations/{r.data['id']}/reject/", {"reason": "Capture illisible"}, format="json")
        assert ok.data["status"] == "rejected"
        assert not ContributionMonth.objects.exists()
        # Le membre peut redéclarer
        assert declare(world).status_code == 201

    def test_liste_reservee_a_la_tresorerie(self, world):
        declare(world)
        assert api(world["member"]).get("/api/v1/payments/declarations/").status_code == 403
        r = api(world["treasurer"]).get("/api/v1/payments/declarations/")
        assert len(r.data) == 1 and r.data[0]["proof"]

    def test_preuve_obligatoire(self, world):
        r = api(world["member"]).post("/api/v1/payments/declarations/", {
            "period_start": f"{world['today'].year}-01", "months": 1, "method": "cash",
        }, format="multipart")
        assert r.status_code == 400


@pytest.mark.django_db
class TestReminders:
    def test_fenetre_des_10_derniers_jours(self):
        opens, ends = services.reminder_window(date(2026, 10, 3))
        assert opens == date(2026, 10, 22) and ends == date(2026, 10, 31)
        opens, _ = services.reminder_window(date(2026, 2, 5))
        assert opens == date(2026, 2, 19)

    def test_envoi_unique_et_destinataires(self, world, monkeypatch):
        today = date(world["today"].year, world["today"].month, 1)
        last = services.reminder_window(today)[1]
        current = today.replace(day=1)
        # « member » a payé le mois en cours, « lead » l'a déclaré : ni l'un ni l'autre n'est relancé
        services.record_contribution(member=world["member"], recorded_by=world["treasurer"], period_start=date(current.year, 1, 1),
                                     months=current.month, paid_on=current, method="cash", notify=False)
        declare(world, who="lead", start=current)
        recipients = {u.email for u in services.reminder_recipients(last)}
        assert "membre@dah.test" not in recipients and "lead@dah.test" not in recipients
        assert "pdt@dah.test" in recipients

        with pytest.raises(Exception):
            services.send_monthly_reminder(world["treasurer"], today=current)  # trop tôt
        count = services.send_monthly_reminder(world["treasurer"], today=last)
        assert count == len(recipients)
        assert ContributionReminder.objects.count() == 1
        with pytest.raises(Exception):
            services.send_monthly_reminder(world["treasurer"], today=last)  # une fois par mois

    def test_reserve_a_la_tresorerie(self, world):
        assert api(world["member"]).get("/api/v1/payments/reminders/").status_code == 403
        r = api(world["treasurer"]).get("/api/v1/payments/reminders/")
        assert r.status_code == 200 and "window_opens" in r.data
