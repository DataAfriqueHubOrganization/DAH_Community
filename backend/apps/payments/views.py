import csv

from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, GenericViewSet

from apps.common.throttling import WRITE_THROTTLES

from . import services
from .models import CashEntry, Contribution, PaymentDeclaration
from .serializers import (
    CashEntrySerializer, ContributionSerializer, DeclarePaymentSerializer, PaymentDeclarationSerializer,
    RecordContributionSerializer, RejectDeclarationSerializer, YearQuerySerializer,
)


class IsTreasurer(BasePermission):
    """Section Trésorerie (accordée par l'admin)."""
    message = "Réservé à la trésorerie."

    def has_permission(self, request, view):
        return services.is_treasurer(request.user)


def _year(request) -> int:
    serializer = YearQuerySerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data.get("year") or timezone.localdate().year


def _situation_payload(user, year, request=None):
    situation = services.member_situation(user, year)
    history = Contribution.objects.filter(user=user).select_related("recorded_by", "declaration")
    return {
        "user_id": user.id,
        "full_name": user.full_name,
        "year": year,
        **situation,
        "points_in_year": services.POINTS_PER_MONTH * situation["months_paid_in_year"],
        "points_per_month": services.POINTS_PER_MONTH,
        "history": ContributionSerializer(history, many=True).data,
        # Déclarations non validées (en attente ou refusées) : visibles sur la fiche.
        "declarations": PaymentDeclarationSerializer(
            PaymentDeclaration.objects.filter(user=user).exclude(status=PaymentDeclaration.STATUS_APPROVED)[:10],
            many=True, context={"request": request},
        ).data,
    }


class MyContributionsView(APIView):
    """Le membre voit seulement, mois par mois, s'il a payé et s'il a eu le point —
    pas de récapitulatif ni de détail de ses paiements."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not services.is_liable(user):
            return Response({"liable": False})
        year = _year(request)
        situation = services.member_situation(user, year)
        declarations = PaymentDeclaration.objects.filter(user=user).exclude(
            status=PaymentDeclaration.STATUS_APPROVED,
        )[:5]
        return Response({
            "liable": True,
            "year": year,
            "rate": situation["rate"],
            "points_per_month": services.POINTS_PER_MONTH,
            "joined_month": situation["joined_month"],
            "next_unpaid": situation["next_unpaid"],
            "late_count": len(situation["late_months"]),
            "months": situation["months"],
            "declarations": PaymentDeclarationSerializer(declarations, many=True, context={"request": request}).data,
        })


class ContributionViewSet(GenericViewSet):
    permission_classes = [IsAuthenticated, IsTreasurer]
    queryset = Contribution.objects.select_related("user", "recorded_by")
    serializer_class = ContributionSerializer

    def list(self, request):
        """Tableau de suivi : situation de chaque membre sur l'année."""
        return Response(services.contributions_overview(_year(request)))

    @action(detail=False, methods=["get"], url_path=r"members/(?P<user_id>\d+)")
    def member(self, request, user_id=None):
        user = get_object_or_404(get_user_model(), pk=user_id)
        if not services.is_liable(user):
            return Response({"detail": "Cette personne n'est pas soumise à cotisation."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_situation_payload(user, _year(request), request))

    def create(self, request):
        serializer = RecordContributionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        contribution = services.record_contribution(
            member=data["user"], recorded_by=request.user, period_start=data["period_start"],
            months=data["months"], paid_on=data["paid_on"], method=data["method"],
            reference=data["reference"], note=data["note"],
        )
        return Response(ContributionSerializer(contribution).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        services.delete_contribution(self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)


class CashEntryViewSet(ModelViewSet):
    """Journal de caisse (trésorerie uniquement)."""
    permission_classes = [IsAuthenticated, IsTreasurer]
    serializer_class = CashEntrySerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    pagination_class = None

    def get_queryset(self):
        qs = CashEntry.objects.select_related("recorded_by")
        params = self.request.query_params
        if params.get("year"):
            qs = qs.filter(date__year=params["year"])
        if params.get("kind"):
            qs = qs.filter(kind=params["kind"])
        if params.get("category"):
            qs = qs.filter(category=params["category"])
        return qs

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    def _guard(self, entry):
        if entry.contribution_id:
            raise PermissionDenied("Ligne de cotisation : modifiez-la depuis l'onglet Cotisations.")

    def perform_update(self, serializer):
        self._guard(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._guard(instance)
        instance.delete()

    @action(detail=False, methods=["get"])
    def summary(self, request):
        return Response(services.cash_summary(_year(request)))

    @action(detail=False, methods=["get"])
    def export(self, request):
        year = _year(request)
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="caisse-dah-{year}.csv"'
        response.write("﻿")  # BOM : Excel lit l'UTF-8 correctement
        writer = csv.writer(response, delimiter=";")
        writer.writerow(["Date", "Type", "Catégorie", "Libellé", "Montant (FCFA)", "Mode", "Référence", "Note", "Saisi par"])
        for e in CashEntry.objects.filter(date__year=year).select_related("recorded_by").order_by("date", "created_at"):
            writer.writerow([
                e.date.isoformat(), e.get_kind_display(), e.get_category_display(), e.label, e.signed_amount,
                e.get_method_display(), e.reference, e.note, e.recorded_by.full_name if e.recorded_by else "",
            ])
        return response


class PaymentDeclarationViewSet(GenericViewSet):
    throttle_classes = WRITE_THROTTLES
    throttle_scope = "declaration"
    """Le membre déclare (avec preuve) ; la trésorerie valide ou refuse."""
    queryset = PaymentDeclaration.objects.select_related("user", "reviewed_by")
    serializer_class = PaymentDeclarationSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsTreasurer()]

    def list(self, request):
        status_filter = request.query_params.get("status", PaymentDeclaration.STATUS_PENDING)
        queryset = self.get_queryset().filter(status=status_filter)
        if status_filter == PaymentDeclaration.STATUS_PENDING:
            queryset = queryset.order_by("created_at")  # les plus anciennes d'abord
        return Response(self.get_serializer(queryset[:200], many=True).data)

    def create(self, request):
        serializer = DeclarePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        declaration = services.declare_payment(member=request.user, **serializer.validated_data)
        return Response(self.get_serializer(declaration).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        services.approve_declaration(self.get_object(), request.user)
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        serializer = RejectDeclarationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        declaration = services.reject_declaration(self.get_object(), request.user, serializer.validated_data["reason"])
        return Response(self.get_serializer(declaration).data)


class ReminderView(APIView):
    """Rappel mensuel de cotisation : état (GET) et envoi (POST)."""
    permission_classes = [IsAuthenticated, IsTreasurer]

    def get(self, request):
        return Response(services.reminder_status())

    def post(self, request):
        count = services.send_monthly_reminder(request.user)
        return Response({"sent": count, **services.reminder_status()})
