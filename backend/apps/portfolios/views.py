from rest_framework import generics
from rest_framework.permissions import AllowAny

from apps.members.models import MemberProfile

from .models import PortfolioProject
from .serializers import PortfolioProjectSerializer


class PublicPortfolioListView(generics.ListAPIView):
    """Tous les projets publics — vitrine globale."""
    serializer_class = PortfolioProjectSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return (
            PortfolioProject.objects
            .filter(member_profile__in=MemberProfile.public())
            .select_related("member_profile__user")
            .order_by("-is_featured", "-created_at")
        )


class MemberPortfolioView(generics.ListAPIView):
    """Projets d'un membre spécifique (par slug de profil)."""
    serializer_class = PortfolioProjectSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return (
            PortfolioProject.objects
            .filter(
                member_profile__slug=self.kwargs["slug"],
                member_profile__in=MemberProfile.public(),
            )
            .select_related("member_profile__user")
            .order_by("-is_featured", "-created_at")
        )
