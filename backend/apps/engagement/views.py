from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from apps.common.permissions import IsBureau, is_bureau
from apps.departments.services import can_manage_department

from . import services
from .models import Award, CheckIn
from .serializers import (
    AdjustmentSerializer, AwardSerializer, CheckInManagerSerializer, CheckInMemberSerializer,
    ConfirmCheckInSerializer, DesignateAwardSerializer, LaunchCheckInSerializer,
    PeriodQuerySerializer, SubmitCheckInSerializer,
)


def _period_params(request):
    query = PeriodQuerySerializer(data=request.query_params)
    query.is_valid(raise_exception=True)
    data = query.validated_data
    return data["period"], data.get("date") or timezone.localdate(), data.get("department")


class RankingView(APIView):
    """Classement d'une période. Bureau : communauté entière ou un département ;
    responsable : uniquement ses départements. Jamais accessible à un simple membre."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period, ref, department = _period_params(request)
        scopes = services.ranking_scopes(request.user)
        if not scopes["global"] and not scopes["departments"]:
            raise PermissionDenied("Le classement est réservé aux responsables et au bureau.")

        if department is None and not scopes["global"]:
            from apps.departments.models import Department
            department = Department.objects.get(pk=scopes["departments"][0]["id"])
        if department is not None and not can_manage_department(request.user, department):
            raise PermissionDenied("Vous ne gérez pas ce département.")

        start, end = services.period_bounds(period, ref)
        awards = []
        if is_bureau(request.user):
            awards = AwardSerializer(
                Award.objects.filter(period_start__gte=start, period_start__lt=end).select_related("user"),
                many=True,
            ).data
        return Response({
            "period": {"type": period, "start": start, "end": end},
            "department": {"id": department.id, "name": department.name} if department else None,
            "scopes": scopes,
            "rows": services.build_ranking(start, end, department),
            "awards": awards,
        })


class MyPointsView(APIView):
    """Points de l'utilisateur connecté sur une période — sans classement."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period, ref, _ = _period_params(request)
        data = services.my_points(request.user, period, ref)
        checkins = CheckIn.objects.filter(member=request.user).exclude(
            status=CheckIn.STATUS_CANCELLED,
        ).select_related("department")
        data["checkins"] = CheckInMemberSerializer(checkins, many=True).data
        return Response(data)


class CheckInViewSet(GenericViewSet):
    permission_classes = [IsAuthenticated]
    queryset = CheckIn.objects.select_related("department", "member", "launched_by", "confirmed_by")

    def _is_manager(self, checkin) -> bool:
        return checkin.member_id != self.request.user.id and can_manage_department(
            self.request.user, checkin.department,
        )

    def get_object(self):
        checkin = super().get_object()
        if checkin.member_id != self.request.user.id and not self._is_manager(checkin):
            raise PermissionDenied("Ce point d'étape ne vous concerne pas.")
        return checkin

    def _serialize(self, checkin):
        serializer = CheckInManagerSerializer if self._is_manager(checkin) else CheckInMemberSerializer
        data = serializer(checkin).data
        data["viewer"] = "manager" if self._is_manager(checkin) else "member"
        return data

    def list(self, request):
        """Points d'étape d'un département (responsable / bureau)."""
        department_id = request.query_params.get("department")
        from apps.departments.models import Department
        try:
            department = Department.objects.get(pk=department_id)
        except (Department.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Département requis."}, status=status.HTTP_400_BAD_REQUEST)
        if not can_manage_department(request.user, department):
            raise PermissionDenied("Vous ne gérez pas ce département.")
        queryset = self.get_queryset().filter(department=department)
        return Response(CheckInManagerSerializer(queryset, many=True).data)

    def retrieve(self, request, pk=None):
        return Response(self._serialize(self.get_object()))

    def create(self, request):
        serializer = LaunchCheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = services.launch_checkins(
            serializer.validated_data["department"], request.user,
            serializer.validated_data["members"], serializer.validated_data["period_label"],
            serializer.validated_data.get("due_date"),
        )
        return Response(
            {"created": len(result["created"]), "skipped": result["skipped"]},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        checkin = self.get_object()
        serializer = SubmitCheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.submit_checkin(checkin, request.user, **serializer.validated_data)
        return Response(self._serialize(checkin))

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        checkin = self.get_object()
        serializer = ConfirmCheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.confirm_checkin(checkin, request.user, **serializer.validated_data)
        return Response(self._serialize(checkin))

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        checkin = self.get_object()
        services.cancel_checkin(checkin, request.user)
        return Response(self._serialize(checkin))


class AwardViewSet(GenericViewSet):
    permission_classes = [IsAuthenticated, IsBureau]
    queryset = Award.objects.select_related("user")
    serializer_class = AwardSerializer

    def list(self, request):
        return Response(AwardSerializer(self.get_queryset(), many=True).data)

    def create(self, request):
        serializer = DesignateAwardSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        award = services.designate_award(data["user"], data["kind"], data["date"], request.user, data["note"])
        return Response(AwardSerializer(award).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        self.get_object().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdjustmentView(APIView):
    """Correction manuelle de points par le bureau — motif obligatoire, tracée au registre."""
    permission_classes = [IsAuthenticated, IsBureau]

    def post(self, request):
        serializer = AdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        entry = services.adjust_points(
            data["user"], data["points"], data["reason"], request.user, data.get("department"),
        )
        return Response({"id": entry.id, "points": entry.points}, status=status.HTTP_201_CREATED)
