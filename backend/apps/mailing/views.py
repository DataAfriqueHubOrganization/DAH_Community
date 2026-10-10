import csv

from django.db.models import Q
from django.http import HttpResponse
from rest_framework import mixins, status
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.common.permissions import SECTIONS, HasSection
from apps.common.throttling import WRITE_THROTTLES

from . import services
from apps.common.throttling import ClientScopedRateThrottle

from .models import MemberEmail, NewsletterSubscriber
from .serializers import (
    EmailContentSerializer, MailableMemberSerializer, MemberEmailDetailSerializer, MemberEmailListSerializer,
    NewsletterSubscribeSerializer, NewsletterSubscriberSerializer, SendMemberEmailSerializer,
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


# ── Newsletter ─────────────────────────────────────────────────────────────────
class NewsletterThrottle(ClientScopedRateThrottle):
    scope = "newsletter"


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([NewsletterThrottle])
def newsletter_subscribe(request):
    """Formulaire du pied de page. Même réponse que l'adresse soit nouvelle ou
    déjà abonnée (on ne révèle pas qui est inscrit)."""
    serializer = NewsletterSubscribeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    services.subscribe_newsletter(serializer.validated_data["email"])
    return Response({"detail": "Merci ! Vous êtes inscrit(e) à la newsletter."}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([NewsletterThrottle])
def newsletter_unsubscribe(request):
    """Lien « Se désabonner » des emails (token propre à chaque abonné)."""
    token = str(request.data.get("token", ""))
    try:
        ok = services.unsubscribe_newsletter(token)
    except Exception:  # noqa: BLE001 — token mal formé
        ok = False
    if not ok:
        return Response({"detail": "Lien de désinscription invalide."}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"detail": "Vous êtes désinscrit(e) de la newsletter."})


class NewsletterSubscriberViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin,
                                  GenericViewSet):
    """Abonnés à la newsletter (section Emails) : liste, ajout, suppression, export."""

    permission_classes = [IsAuthenticated, HasSection(SECTIONS.EMAILS)]
    serializer_class = NewsletterSubscriberSerializer

    def get_queryset(self):
        qs = NewsletterSubscriber.objects.all()
        status_filter = self.request.query_params.get("status")
        if status_filter == "active":
            qs = qs.filter(is_active=True)
        elif status_filter == "unsubscribed":
            qs = qs.filter(is_active=False)
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(email__icontains=search))
        return qs

    def create(self, request):
        serializer = NewsletterSubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sub = services.subscribe_newsletter(serializer.validated_data["email"], source="admin")
        return Response(NewsletterSubscriberSerializer(sub).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def export(self, request):
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="abonnes-newsletter.csv"'
        writer = csv.writer(response)
        writer.writerow(["email", "abonne", "origine", "inscrit_le", "desinscrit_le"])
        for sub in self.get_queryset():
            writer.writerow([sub.email, "oui" if sub.is_active else "non", sub.source,
                             sub.created_at.date().isoformat(),
                             sub.unsubscribed_at.date().isoformat() if sub.unsubscribed_at else ""])
        return response
