import logging
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.background import fire_and_forget
from apps.common.permissions import SECTIONS, HasSection
from .models import Candidature
from .serializers import (
    CandidatureCreateSerializer, CandidatureListSerializer,
    CandidatureDetailSerializer, ReviewCandidatureSerializer,
)
from .services import accept_candidature, reject_candidature
from .tasks import send_candidature_received_notification, send_candidature_confirmation_email

logger = logging.getLogger(__name__)


class CandidatureCreateView(generics.CreateAPIView):
    throttle_scope = "candidature"
    serializer_class = CandidatureCreateSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        candidature = serializer.save()
        # En tâche de fond : deux envois synchrones à la suite (notification admin +
        # accusé de réception) pouvaient dépasser le timeout de Gunicorn.
        fire_and_forget(
            send_candidature_received_notification.delay, candidature.pk,
            error_message=f"Impossible d'envoyer la notification de candidature {candidature.pk}",
        )
        fire_and_forget(
            send_candidature_confirmation_email.delay, candidature.pk,
            error_message=f"Impossible d'envoyer l'accusé de réception à {candidature.email}",
        )
        logger.info("Nouvelle candidature reçue : %s", candidature.email)
        return Response(
            {"detail": "Votre candidature a bien été reçue. Vous serez contacté par email."},
            status=status.HTTP_201_CREATED,
        )


class CandidatureListView(generics.ListAPIView):
    serializer_class = CandidatureListSerializer
    permission_classes = [HasSection(SECTIONS.APPLICATIONS)]
    pagination_class = None  # dataset trop petit pour paginer
    filterset_fields = ["status"]
    search_fields = ["first_name", "last_name", "email", "country", "profession"]

    def get_queryset(self):
        return Candidature.objects.select_related("reviewed_by").order_by("-created_at")


class CandidatureDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = CandidatureDetailSerializer
    permission_classes = [HasSection(SECTIONS.APPLICATIONS)]
    queryset = Candidature.objects.select_related("reviewed_by")


class ReviewCandidatureView(APIView):
    permission_classes = [HasSection(SECTIONS.APPLICATIONS)]

    def post(self, request, pk):
        try:
            candidature = Candidature.objects.get(pk=pk)
        except Candidature.DoesNotExist:
            return Response({"detail": "Candidature introuvable."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReviewCandidatureSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            if serializer.validated_data["action"] == "accept":
                candidature = accept_candidature(candidature, request.user)
                logger.info("Candidature acceptée : %s par %s", candidature.email, request.user.email)
            else:
                candidature = reject_candidature(
                    candidature, request.user,
                    reason=serializer.validated_data.get("rejection_reason", ""),
                )
                logger.info("Candidature rejetée : %s par %s", candidature.email, request.user.email)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(CandidatureDetailSerializer(candidature).data)
