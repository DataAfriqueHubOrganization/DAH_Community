"""Cotisations mensuelles et caisse.

Règles :
  * Tarif : 500 FCFA / mois pour un membre, 1000 FCFA / mois pour les
    responsables (et adjoints) de département et les membres du bureau. Le tarif
    est figé sur chaque mois payé ; un changement de rôle s'applique aux mois
    suivants.
  * La cotisation est due à partir du mois d'adhésion. Un mois non réglé est « en
    retard » une fois terminé ; pendant le mois, il est « à régler ».
  * Chaque mois réglé rapporte POINTS_PER_MONTH points, comptés dans ce mois-là.
  * Seuls le trésorier, son adjoint et l'admin enregistrent des paiements et
    tiennent la caisse.
"""
from datetime import date, datetime, time

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.common.background import fire_and_forget
from apps.accounts.models import POSTES, ROLES

from .models import CashEntry, Contribution, ContributionMonth

MEMBER_RATE = 500
LEAD_RATE = 1000
POINTS_PER_MONTH = 5
MAX_MONTHS_PER_PAYMENT = 24

TREASURY_POSTES = (POSTES.TRESORIER, POSTES.TRESORIER_ADJ)

MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
             "août", "septembre", "octobre", "novembre", "décembre"]


# ── Utilitaires de mois ──────────────────────────────────────────────────────

def month_start(d: date) -> date:
    return d.replace(day=1)


def add_months(d: date, n: int) -> date:
    index = d.year * 12 + (d.month - 1) + n
    return date(index // 12, index % 12 + 1, 1)


def month_label(d: date) -> str:
    return f"{MONTHS_FR[d.month - 1]} {d.year}"


def period_label(start: date, months: int) -> str:
    end = add_months(start, months - 1)
    if months == 1:
        return month_label(start)
    return f"{month_label(start)} → {month_label(end)}"


# ── Qui paie, combien, depuis quand ─────────────────────────────────────────

def is_treasurer(user) -> bool:
    return bool(user and user.is_authenticated) and (
        user.role == ROLES.ADMIN or user.poste in TREASURY_POSTES
    )


def liable_members():
    """Membres soumis à cotisation : membres, responsables et membres du bureau
    (un compte admin sans poste est un compte technique)."""
    User = get_user_model()
    return User.objects.filter(is_active=True).filter(
        Q(role__in=[ROLES.MEMBRE, ROLES.RESPONSABLE]) | Q(poste__isnull=False)
    )


def is_liable(user) -> bool:
    return user.is_active and (user.role in (ROLES.MEMBRE, ROLES.RESPONSABLE) or bool(user.poste))


def lead_user_ids() -> set:
    from apps.departments.models import Department
    ids = set()
    for lead, co_lead in Department.objects.values_list("lead_id", "co_lead_id"):
        ids.update(i for i in (lead, co_lead) if i)
    return ids


def monthly_rate(user, leads: set | None = None) -> int:
    leads = lead_user_ids() if leads is None else leads
    if user.poste or user.role == ROLES.RESPONSABLE or user.id in leads:
        return LEAD_RATE
    return MEMBER_RATE


def joined_month(user) -> date:
    """Mois d'adhésion : acceptation de la candidature, sinon création du profil
    membre, sinon création du compte."""
    candidature = getattr(user, "candidature", None)
    if candidature is not None and candidature.reviewed_at and candidature.status == "accepted":
        moment = candidature.reviewed_at
    else:
        profile = getattr(user, "member_profile", None)
        moment = profile.created_at if profile is not None else user.created_at
    return month_start(timezone.localtime(moment).date())


# ── Situation d'un membre ───────────────────────────────────────────────────

STATUS_PAID = "paid"
STATUS_LATE = "late"
STATUS_DUE = "due"            # mois en cours, non réglé
STATUS_UPCOMING = "upcoming"
STATUS_NOT_DUE = "not_due"    # avant l'adhésion


def member_situation(user, year: int, *, paid_months: dict | None = None, leads: set | None = None,
                     today: date | None = None) -> dict:
    """Mois de l'année (statut et montant), retard, reste dû, « à jour jusqu'à »."""
    today = today or timezone.localdate()
    current = month_start(today)
    rate = monthly_rate(user, leads)
    joined = joined_month(user)
    if paid_months is None:
        paid_months = dict(
            ContributionMonth.objects.filter(user=user).values_list("month", "rate")
        )

    months = []
    for m in range(1, 13):
        month = date(year, m, 1)
        if month in paid_months:
            status, amount = STATUS_PAID, paid_months[month]
        elif month < joined:
            status, amount = STATUS_NOT_DUE, 0
        elif month < current:
            status, amount = STATUS_LATE, rate
        elif month == current:
            status, amount = STATUS_DUE, rate
        else:
            status, amount = STATUS_UPCOMING, rate
        months.append({"month": month, "status": status, "amount": amount})

    # Retard et reste dû : sur toute la période depuis l'adhésion, pas seulement l'année affichée.
    late = []
    cursor = joined
    while cursor < current:
        if cursor not in paid_months:
            late.append(cursor)
        cursor = add_months(cursor, 1)
    current_due = current >= joined and current not in paid_months
    owed = (len(late) + (1 if current_due else 0)) * rate

    # « À jour jusqu'à » : dernier mois d'une suite ininterrompue depuis l'adhésion.
    paid_until = None
    cursor = joined
    while cursor in paid_months:
        paid_until = cursor
        cursor = add_months(cursor, 1)

    if not paid_months and (late or current_due):
        overall = "never_paid"
    elif late:
        overall = "late"
    else:
        overall = "up_to_date"

    return {
        "rate": rate,
        "joined_month": joined,
        "months": months,
        "late_months": late,
        "owed": owed,
        "paid_until": paid_until,
        "next_unpaid": first_unpaid_month(user, paid_months, joined),
        "status": overall,
        "paid_in_year": sum(a for mo, a in paid_months.items() if mo.year == year),
        "months_paid_in_year": sum(1 for mo in paid_months if mo.year == year),
    }


def first_unpaid_month(user, paid_months: dict, joined: date | None = None) -> date:
    cursor = joined or joined_month(user)
    while cursor in paid_months:
        cursor = add_months(cursor, 1)
    return cursor


# ── Enregistrer / annuler un paiement ───────────────────────────────────────

@transaction.atomic
def record_contribution(*, member, recorded_by, period_start: date, months: int, paid_on: date,
                        method: str, reference: str = "", note: str = "", notify: bool = True) -> Contribution:
    from apps.departments.services import get_current_membership
    from apps.engagement.models import PointEntry

    if not is_liable(member):
        raise ValidationError({"user": "Cette personne n'est pas soumise à cotisation."})
    if not 1 <= months <= MAX_MONTHS_PER_PAYMENT:
        raise ValidationError({"months": f"Entre 1 et {MAX_MONTHS_PER_PAYMENT} mois par paiement."})

    start = month_start(period_start)
    if start < joined_month(member):
        raise ValidationError({"period_start": "La cotisation n'est due qu'à partir du mois d'adhésion."})
    covered = [add_months(start, i) for i in range(months)]
    # Verrou : deux saisies simultanées ne doivent pas payer deux fois le même mois.
    get_user_model().objects.select_for_update().filter(pk=member.pk).first()
    already = set(
        ContributionMonth.objects.filter(user=member, month__in=covered).values_list("month", flat=True)
    )
    if already:
        raise ValidationError({"period_start": "Déjà réglé : " + ", ".join(month_label(m) for m in sorted(already)) + "."})

    rate = monthly_rate(member)
    contribution = Contribution.objects.create(
        user=member, period_start=start, months=months, monthly_rate=rate, amount=rate * months,
        paid_on=paid_on, method=method, reference=reference, note=note, recorded_by=recorded_by,
    )
    membership = get_current_membership(member)
    for month in covered:
        cm = ContributionMonth.objects.create(contribution=contribution, user=member, month=month, rate=rate)
        PointEntry.objects.create(
            user=member, points=POINTS_PER_MONTH, source=PointEntry.SOURCE_CONTRIBUTION,
            department_id=membership.department_id if membership else None,
            contribution_month=cm, label=f"Cotisation — {month_label(month)}",
            awarded_by=recorded_by,
            # Compté dans le mois couvert (milieu du mois, fuseau local).
            awarded_at=timezone.make_aware(datetime.combine(month.replace(day=15), time(12))),
        )
    CashEntry.objects.create(
        kind=CashEntry.KIND_INCOME, category=CashEntry.CATEGORY_CONTRIBUTIONS,
        label=f"Cotisation — {member.full_name}", amount=contribution.amount, date=paid_on,
        method=method, reference=reference, note=period_label(start, months),
        contribution=contribution, recorded_by=recorded_by,
    )

    if not notify:
        return contribution
    from .tasks import send_contribution_receipt
    transaction.on_commit(lambda: fire_and_forget(
        send_contribution_receipt.delay, contribution.pk,
        error_message=f"Reçu de cotisation impossible à envoyer ({contribution.pk})",
    ))
    return contribution


def delete_contribution(contribution: Contribution) -> None:
    """Annule une saisie erronée : mois, points et ligne de caisse disparaissent avec elle."""
    contribution.delete()


# ── Caisse ──────────────────────────────────────────────────────────────────

def cash_summary(year: int) -> dict:
    entries = CashEntry.objects.all()
    totals = entries.aggregate(
        income=Sum("amount", filter=Q(kind=CashEntry.KIND_INCOME)),
        expense=Sum("amount", filter=Q(kind=CashEntry.KIND_EXPENSE)),
    )
    in_year = entries.filter(date__year=year)
    by_month = {m: {"month": m, "income": 0, "expense": 0} for m in range(1, 13)}
    for row in in_year.values("date__month", "kind").annotate(total=Sum("amount")):
        by_month[row["date__month"]]["income" if row["kind"] == CashEntry.KIND_INCOME else "expense"] = row["total"]
    by_category = list(
        in_year.values("kind", "category").annotate(total=Sum("amount")).order_by("kind", "-total")
    )
    income = sum(m["income"] for m in by_month.values())
    expense = sum(m["expense"] for m in by_month.values())
    return {
        "year": year,
        "balance": (totals["income"] or 0) - (totals["expense"] or 0),
        "income": income,
        "expense": expense,
        "result": income - expense,
        "contributions": in_year.filter(category=CashEntry.CATEGORY_CONTRIBUTIONS).aggregate(t=Sum("amount"))["t"] or 0,
        "by_month": list(by_month.values()),
        "by_category": by_category,
    }


def contributions_overview(year: int, today: date | None = None) -> dict:
    """Tableau du trésorier : situation de chaque membre + indicateurs."""
    today = today or timezone.localdate()
    leads = lead_user_ids()
    members = list(
        liable_members().select_related("member_profile", "candidature").order_by("first_name", "last_name")
    )
    paid = {}
    for user_id, month, rate in ContributionMonth.objects.filter(user__in=members).values_list("user_id", "month", "rate"):
        paid.setdefault(user_id, {})[month] = rate

    from apps.departments.services import get_department_dict
    rows, expected_to_date = [], 0
    current = month_start(today)
    for user in members:
        situation = member_situation(user, year, paid_months=paid.get(user.id, {}), leads=leads, today=today)
        # Attendu à ce jour sur l'année : mois échus ou en cours depuis l'adhésion.
        expected_to_date += sum(
            m["amount"] for m in situation["months"]
            if m["status"] != STATUS_NOT_DUE and m["month"] <= current
        )
        dept = get_department_dict(user)
        rows.append({
            "user_id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "avatar": user.avatar.url if user.avatar else None,
            "role": user.role,
            "poste": user.poste,
            "department_name": dept["name"] if dept else None,
            **situation,
        })

    collected = ContributionMonth.objects.filter(month__year=year, month__lte=current).aggregate(t=Sum("rate"))["t"] or 0
    return {
        "year": year,
        "rows": rows,
        "collected": Contribution.objects.filter(paid_on__year=year).aggregate(t=Sum("amount"))["t"] or 0,
        "expected_to_date": expected_to_date,
        "recovery_rate": round(100 * collected / expected_to_date) if expected_to_date else None,
        "late_count": sum(1 for r in rows if r["status"] in ("late", "never_paid")),
        "late_amount": sum(r["owed"] for r in rows if r["status"] in ("late", "never_paid")),
    }
