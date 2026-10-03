from django.http import HttpResponse
from rest_framework import generics, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from apps.common.permissions import IsAdminOrBureau
from .filters import EventFilter
from .models import Event, EventParticipant
from .serializers import (
    EventListSerializer, EventDetailSerializer, EventWriteSerializer,
    EventParticipantSerializer, RegisterForEventSerializer, ParticipantLookupSerializer,
    EventReminderSerializer, SendEventReminderSerializer,
    ParticipantWithEventSerializer, ParticipantsFilterSerializer,
)
from .services import (
    register_participant, validate_presence, generate_qr_code,
    export_participants_excel, find_latest_participant_info, send_event_reminder,
    participants_queryset, export_all_participants_excel,
)


class EventViewSet(ModelViewSet):
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = EventFilter
    search_fields = ["title", "description"]
    ordering_fields = ["start_date", "created_at"]

    def get_queryset(self):
        qs = Event.objects.prefetch_related("participants", "speakers")
        if not self.request.user.is_authenticated or not (
            self.request.user.is_admin or self.request.user.is_bureau
        ):
            return qs.filter(is_published=True)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return EventListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return EventWriteSerializer
        return EventDetailSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsAdminOrBureau()]
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        # Actions personnalisées : leurs propres permission_classes (inscription
        # publique ; participants, export, présence, rappels réservés au bureau).
        return super().get_permissions()

    def perform_create(self, serializer):
        event = serializer.save(created_by=self.request.user)
        generate_qr_code(event)

    # ── Tous les participants (tous événements), par période ou par événements ──
    def _all_participants(self, request):
        filters = ParticipantsFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        data = filters.validated_data
        qs = participants_queryset(
            date_from=data.get("date_from"), date_to=data.get("date_to"), event_ids=data.get("events"),
        )
        return qs, data["group"]

    @action(detail=False, methods=["get"], url_path="participants", permission_classes=[IsAuthenticated, IsAdminOrBureau])
    def all_participants(self, request):
        qs, _ = self._all_participants(request)
        return Response(ParticipantWithEventSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="participants/export", permission_classes=[IsAuthenticated, IsAdminOrBureau])
    def export_all_participants(self, request):
        qs, group = self._all_participants(request)
        response = HttpResponse(
            export_all_participants_excel(list(qs), by_person=group == "person"),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="participants_dah.xlsx"'
        return response

    @action(detail=True, methods=["post"], permission_classes=[AllowAny])
    def register(self, request, pk=None):
        event = self.get_object()
        serializer = RegisterForEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user if request.user.is_authenticated else None
        participant = register_participant(
            event, user,
            email=serializer.validated_data["email"],
            first_name=serializer.validated_data["first_name"],
            last_name=serializer.validated_data["last_name"],
            nationality=serializer.validated_data["nationality"],
            organisation=serializer.validated_data["organisation"],
            profession=serializer.validated_data["profession"],
            motivation=serializer.validated_data["motivation"],
        )
        return Response(
            EventParticipantSerializer(participant).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="participants/lookup", permission_classes=[AllowAny])
    def participant_lookup(self, request):
        serializer = ParticipantLookupSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        participant = find_latest_participant_info(serializer.validated_data["email"])
        if participant is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response({
            "first_name": participant.first_name,
            "last_name": participant.last_name,
            "nationality": participant.nationality,
            "organisation": participant.organisation,
            "profession": participant.profession,
        })

    @action(detail=True, methods=["post"],
            url_path="validate/(?P<participant_id>[^/.]+)",
            permission_classes=[IsAuthenticated, IsAdminOrBureau])
    def validate_presence(self, request, pk=None, participant_id=None):
        event = self.get_object()
        try:
            participant = event.participants.get(pk=participant_id)
        except EventParticipant.DoesNotExist:
            return Response({"detail": "Participant introuvable."}, status=status.HTTP_404_NOT_FOUND)
        participant = validate_presence(participant)
        return Response(EventParticipantSerializer(participant).data)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated, IsAdminOrBureau])
    def participants(self, request, pk=None):
        event = self.get_object()
        queryset = event.participants.select_related("user").order_by("created_at")
        serializer = EventParticipantSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAdminOrBureau])
    def remind(self, request, pk=None):
        """Rappel par email aux inscrits (ou test à soi-même avec test=true)."""
        event = self.get_object()
        serializer = SendEventReminderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = send_event_reminder(event, request.user, **serializer.validated_data)
        return Response({"sent": count, "test": serializer.validated_data["test"]})

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated, IsAdminOrBureau])
    def reminders(self, request, pk=None):
        event = self.get_object()
        queryset = event.reminders.select_related("sent_by")[:20]
        return Response(EventReminderSerializer(queryset, many=True).data)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated, IsAdminOrBureau])
    def export(self, request, pk=None):
        event = self.get_object()
        content = export_participants_excel(event)
        response = HttpResponse(
            content,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="participants_{event.pk}.xlsx"'
        return response
