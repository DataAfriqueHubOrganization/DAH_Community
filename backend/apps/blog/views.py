from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from django.utils import timezone
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.common.permissions import SECTIONS, HasSection, has_section
from apps.common.throttling import WRITE_THROTTLES
from .models import Article, ArticleCategory, ArticleComment, ArticleLike
from .serializers import (
    ArticleListSerializer, ArticleDetailSerializer, ArticleAdminSerializer, ArticleCategorySerializer,
    ArticleCommentSerializer,
)


class ArticleListView(generics.ListAPIView):
    serializer_class = ArticleListSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return (
            Article.objects.live()
            .select_related("author", "category")
            .order_by("-published_at")
        )


class ArticleDetailView(generics.RetrieveAPIView):
    serializer_class = ArticleDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return Article.objects.live().select_related("author", "category")


class ArticleCategoryListView(generics.ListCreateAPIView):
    """Catégories : liste et création depuis l'éditeur d'article (section Actualités)."""
    queryset = ArticleCategory.objects.order_by("name")
    serializer_class = ArticleCategorySerializer
    permission_classes = [IsAuthenticated, HasSection(SECTIONS.NEWS)]
    pagination_class = None

    def perform_create(self, serializer):
        base = slugify(serializer.validated_data["name"]) or "categorie"
        slug, n = base, 1
        while ArticleCategory.objects.filter(slug=slug).exists():
            n += 1
            slug = f"{base}-{n}"
        serializer.save(slug=slug)


class ArticleAdminViewSet(ModelViewSet):
    queryset = (
        Article.objects.select_related("author", "category")
        .annotate(likes_count=Count("likes", distinct=True), comments_count=Count("comments", distinct=True))
        .order_by("-created_at")
    )
    serializer_class = ArticleAdminSerializer
    permission_classes = [IsAuthenticated, HasSection(SECTIONS.NEWS)]

    def perform_create(self, serializer):
        self._save_with_published_at(serializer, author=self.request.user)

    def perform_update(self, serializer):
        self._save_with_published_at(serializer)

    def _save_with_published_at(self, serializer, **extra):
        published_at = serializer.validated_data.get("published_at")
        article_status = serializer.validated_data.get("status")
        if article_status == Article.STATUS_PUBLISHED and not published_at:
            extra["published_at"] = timezone.now()
        serializer.save(**extra)


def _get_published_article(slug):
    return get_object_or_404(Article.objects.live(), slug=slug)


class ArticleCommentListCreateView(generics.ListCreateAPIView):
    serializer_class = ArticleCommentSerializer
    throttle_classes = WRITE_THROTTLES
    throttle_scope = "comment"
    pagination_class = None

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        return _get_published_article(self.kwargs["slug"]).comments.select_related("author").order_by("created_at")

    def perform_create(self, serializer):
        serializer.save(article=_get_published_article(self.kwargs["slug"]), author=self.request.user)

    def get_serializer_context(self):
        return {"request": self.request}


class ArticleCommentDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ArticleCommentSerializer
    lookup_url_kwarg = "comment_id"

    def get_queryset(self):
        return ArticleComment.objects.filter(article__slug=self.kwargs["slug"])

    def get_object(self):
        obj = get_object_or_404(self.get_queryset(), pk=self.kwargs["comment_id"])
        user = self.request.user
        if not (user.id == obj.author_id or has_section(user, SECTIONS.NEWS)):
            raise PermissionDenied("Vous ne pouvez supprimer que votre propre commentaire.")
        return obj


class ArticleLikeToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        article = _get_published_article(slug)
        like, created = ArticleLike.objects.get_or_create(article=article, user=request.user)
        if not created:
            like.delete()
        return Response({"liked": created, "likes_count": article.likes.count()})
