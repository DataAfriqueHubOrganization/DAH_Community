from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from apps.common.mixins import TimestampMixin


class ArticleCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name


class ArticleQuerySet(models.QuerySet):
    def live(self):
        """Visibles sur le site : publiés, ou programmés dont la date est passée —
        sans tâche planifiée, la publication programmée se fait à la lecture."""
        now = timezone.now()
        return self.filter(
            models.Q(status=Article.STATUS_PUBLISHED)
            | models.Q(status=Article.STATUS_SCHEDULED, published_at__lte=now)
        )


class Article(TimestampMixin):
    STATUS_DRAFT = "draft"
    STATUS_SCHEDULED = "scheduled"
    STATUS_PUBLISHED = "published"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Brouillon"),
        (STATUS_SCHEDULED, "Programmé"),
        (STATUS_PUBLISHED, "Publié"),
    ]

    title = models.CharField(max_length=300)
    slug = models.SlugField(unique=True, blank=True, max_length=320)
    content = models.TextField()
    excerpt = models.TextField(blank=True, max_length=500)
    cover_image = models.ImageField(upload_to="blog/covers/", null=True, blank=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    category = models.ForeignKey(ArticleCategory, null=True, blank=True, on_delete=models.SET_NULL)
    tags = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    seo_title = models.CharField(max_length=70, blank=True)
    seo_description = models.CharField(max_length=160, blank=True)

    objects = ArticleQuerySet.as_manager()

    class Meta:
        ordering = ["-published_at", "-created_at"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:320]
        super().save(*args, **kwargs)


class ArticleComment(TimestampMixin):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="article_comments")
    content = models.TextField()

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.author} → {self.article}"


class ArticleLike(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="article_likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("article", "user")]

    def __str__(self):
        return f"{self.user} ♥ {self.article}"
