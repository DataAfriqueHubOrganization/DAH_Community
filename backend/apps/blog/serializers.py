from rest_framework import serializers
from apps.common.permissions import is_bureau
from .models import Article, ArticleCategory, ArticleComment


class ArticleCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleCategory
        fields = ["id", "name", "slug"]
        read_only_fields = ["id", "slug"]


class ArticleListSerializer(serializers.ModelSerializer):
    """Serializer public — pas d'auteur exposé (voir ArticleAdminSerializer pour la gestion)."""
    category = ArticleCategorySerializer(read_only=True)
    tags_list = serializers.SerializerMethodField()
    comments_count = serializers.IntegerField(source="comments.count", read_only=True)
    likes_count = serializers.IntegerField(source="likes.count", read_only=True)
    is_liked_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = [
            "id", "slug", "title", "excerpt", "cover_image",
            "category", "tags_list", "published_at",
            "comments_count", "likes_count", "is_liked_by_me",
        ]

    def get_tags_list(self, obj):
        return [t.strip() for t in obj.tags.split(",") if t.strip()] if obj.tags else []

    def get_is_liked_by_me(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.likes.filter(user=request.user).exists()


class ArticleDetailSerializer(ArticleListSerializer):
    class Meta(ArticleListSerializer.Meta):
        fields = ArticleListSerializer.Meta.fields + ["content", "seo_title", "seo_description"]


class ArticleAdminSerializer(serializers.ModelSerializer):
    """Lecture + écriture pour la gestion admin — expose le statut et category_id
    en écriture, contrairement aux serializers publics (lecture seule, publiés)."""
    author_name = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    # Annotés par ArticleAdminViewSet (0 après une création, avant rechargement).
    likes_count = serializers.IntegerField(read_only=True, default=0)
    comments_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Article
        fields = [
            "id", "slug", "title", "content", "excerpt", "cover_image",
            "author_name", "category", "category_name", "tags", "status",
            "published_at", "seo_title", "seo_description", "likes_count", "comments_count", "created_at",
        ]
        read_only_fields = ["id", "slug", "created_at"]

    def get_author_name(self, obj):
        return obj.author.full_name if obj.author else None


class ArticleCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.full_name", read_only=True)
    author_avatar = serializers.ImageField(source="author.avatar", read_only=True)
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = ArticleComment
        fields = ["id", "content", "author_name", "author_avatar", "created_at", "can_delete"]
        read_only_fields = ["id", "author_name", "author_avatar", "created_at", "can_delete"]

    def get_can_delete(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        user = request.user
        return user.id == obj.author_id or user.role == "admin" or is_bureau(user)
