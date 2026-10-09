from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.common.permissions import SECTIONS, HasSection
from apps.common.throttling import WRITE_THROTTLES

from . import services
from .models import MemberEmail
from .serializers import (
    EmailContentSerializer, MailableMemberSerializer, MemberEmailDetailSerializer, MemberEmailListSerializer,
    SendMemberEmailSerializer,
)


class MemberEmailViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    """Emails de l'administration aux membres (section Emails) : envoi, test,
    aperçu, historique et renvoi aux échecs."""

    permission_classes = [IsAuthenticated, HasSection(SECTIONS.EMAILS)]
    throttle_classes = WRITE_THROTTLES
    # Quota propre aux envois (voir @action(throttle_scope=…)) ; lecture libre.
    throttle_scope = None

    def get_queryset(self):
        return MemberEmailListSerializer.annotate(MemberEmail.objects.all())

    def get_serializer_class(self):
        return MemberEmailDetailSerializer if self.action == "retrieve" else MemberEmailListSerializer

    def get_object(self):
        obj = super().get_object()
        if self.action == "retrieve":
            obj = MemberEmailListSerializer.annotate(MemberEmail.objects.filter(pk=obj.pk)).prefetch_related(
                "recipients").get()
        return obj

    def create(self, request):
        serializer = SendMemberEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        content = {k: data[k] for k in ("subject", "body", "cta_label", "cta_url")}
        if data["test"]:
            services.send_test(request.user, **content)
            return Response({"test": True, "sent": 1, "email": request.user.email})
        mail = services.send_member_email(
            request.user, **content, template=data["template"], audience=data["audience"],
            department=data.get("department"), user_ids=data["user_ids"],
        )
        mail = self.get_queryset().get(pk=mail.pk)
        return Response(MemberEmailListSerializer(mail).data, status=status.HTTP_201_CREATED)

    # Le décorateur @action ne s'applique pas à create : quota posé ici.
    def get_throttles(self):
        if self.action in ("create", "retry"):
            self.throttle_scope = "member_email"
        return super().get_throttles()

    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        count = services.retry_failed(self.get_object())
        return Response({"retried": count})

    @action(detail=False, methods=["post"])
    def preview(self, request):
        serializer = EmailContentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(services.render_preview(request.user, **serializer.validated_data))

    @action(detail=False, methods=["get"])
    def audiences(self, request):
        return Response(services.audiences_summary())

    @action(detail=False, methods=["get"])
    def members(self, request):
        users = services.search_members(request.query_params.get("search", ""))
        return Response(MailableMemberSerializer(users, many=True).data)
