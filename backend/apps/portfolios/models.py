from django.db import models
from apps.common.mixins import TimestampMixin
from apps.common.validators import MaxFileSizeValidator
from django.core.validators import FileExtensionValidator


class PortfolioProject(TimestampMixin):
    member_profile = models.ForeignKey(
        "members.MemberProfile", on_delete=models.CASCADE, related_name="portfolio_projects"
    )
    title = models.CharField(max_length=300)
    description = models.TextField()
    tech_stack = models.CharField(max_length=500, blank=True, help_text="Technologies séparées par des virgules")
    demo_url = models.URLField(blank=True)
    repo_url = models.URLField(blank=True)
    image = models.ImageField(upload_to="portfolio/", null=True, blank=True, validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp", "gif"]), MaxFileSizeValidator(8)])
    is_featured = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_featured", "-created_at"]

    def __str__(self):
        return self.title
