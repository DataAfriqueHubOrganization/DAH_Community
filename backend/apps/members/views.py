from rest_framework import generics, viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from apps.common.permissions import SECTIONS, HasSection
from .models import MemberProfile, MemberExperience, MemberCertification, SocialLink
from .serializers import (
    MemberProfileSerializer, PublicMemberProfileSerializer,
    MemberListSerializer, PublicMemberListSerializer, MemberExperienceSerializer,
    MemberCertificationSerializer, SocialLinkSerializer,
)


def _filter_by_department(queryset, department_id):
    """Filtre un queryset de MemberProfile sur le département actif de l'utilisateur
    (adhésion en cours) — le département n'étant pas un champ direct, on passe par
    DepartmentMembership plutôt que filterset_fields."""
    if not department_id:
        return queryset
    from django.db.models import Q
    from django.utils import timezone
    from apps.departments.models import DepartmentMembership

    today = timezone.now().date()
    user_ids = DepartmentMembership.objects.filter(
        department_id=department_id,
    ).filter(Q(end_date__isnull=True) | Q(end_date__gte=today)).values_list("user_id", flat=True)
    return queryset.filter(user_id__in=user_ids)


class MemberListView(generics.ListAPIView):
    """Liste des membres — admin et bureau uniquement."""
    serializer_class = MemberListSerializer
    permission_classes = [IsAuthenticated, HasSection(SECTIONS.MEMBERS)]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ["user__first_name", "user__last_name", "skills"]
    filterset_fields = ["user__role"]

    def get_queryset(self):
        qs = MemberProfile.objects.select_related("user").order_by("-created_at")
        return _filter_by_department(qs, self.request.query_params.get("department"))


class MyProfileView(generics.RetrieveUpdateAPIView):
    """Consultation et édition du profil de l'utilisateur connecté."""
    serializer_class = MemberProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        profile, _ = MemberProfile.objects.get_or_create(user=self.request.user)
        return profile


class PublicMemberListView(generics.ListAPIView):
    """Liste publique des membres — accessible sans authentification."""
    serializer_class = PublicMemberListSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = (
            MemberProfile.objects
            .filter(is_public=True)
            .exclude(user__role__in=["visiteur", "admin"])
            .select_related("user")
            .prefetch_related("experiences")
            .order_by("user__first_name")
        )
        return _filter_by_department(qs, self.request.query_params.get("department"))


class PublicProfileView(generics.RetrieveAPIView):
    """Profil public d'un membre — accessible sans authentification."""
    serializer_class = PublicMemberProfileSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return MemberProfile.objects.filter(is_public=True).select_related("user").prefetch_related("experiences", "certifications", "social_links")


class MemberExperienceViewSet(viewsets.ModelViewSet):
    serializer_class = MemberExperienceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MemberExperience.objects.none()
        return MemberExperience.objects.filter(member__user=self.request.user)

    def perform_create(self, serializer):
        profile, _ = MemberProfile.objects.get_or_create(user=self.request.user)
        serializer.save(member=profile)


class MemberCertificationViewSet(viewsets.ModelViewSet):
    serializer_class = MemberCertificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MemberCertification.objects.none()
        return MemberCertification.objects.filter(member__user=self.request.user)

    def perform_create(self, serializer):
        profile, _ = MemberProfile.objects.get_or_create(user=self.request.user)
        serializer.save(member=profile)


class SocialLinkViewSet(viewsets.ModelViewSet):
    serializer_class = SocialLinkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return SocialLink.objects.none()
        return SocialLink.objects.filter(member__user=self.request.user)

    def perform_create(self, serializer):
        profile, _ = MemberProfile.objects.get_or_create(user=self.request.user)
        serializer.save(member=profile)
