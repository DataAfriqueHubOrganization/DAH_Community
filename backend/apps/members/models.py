from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils.text import slugify
from apps.common.mixins import TimestampMixin
from apps.common.validators import MaxFileSizeValidator
from django.core.validators import FileExtensionValidator


def _cv_storage():
    """CV du profil : document privé (voir apps.common.storage)."""
    from apps.common.storage import private_storage
    return private_storage()


class MemberProfile(TimestampMixin):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="member_profile",
    )
    slug = models.SlugField(unique=True, blank=True)
    bio = models.TextField(blank=True)
    skills = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    github_url = models.URLField(blank=True)
    linkedin_url = models.URLField(blank=True)
    website_url = models.URLField(blank=True)
    cv = models.FileField(
        upload_to="cvs/", null=True, blank=True, storage=_cv_storage,
        validators=[FileExtensionValidator(["pdf"]), MaxFileSizeValidator(10)],
    )
    is_public = models.BooleanField(default=True)
    member_number = models.CharField(max_length=20, unique=True, null=True, blank=True)

    class Meta:
        verbose_name = "Profil membre"
        verbose_name_plural = "Profils membres"

    def __str__(self):
        return f"Profil de {self.user.full_name}"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(f"{self.user.first_name} {self.user.last_name}")
            slug = base
            n = 1
            while MemberProfile.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{n}"
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)


class MemberExperience(TimestampMixin):
    member = models.ForeignKey(MemberProfile, on_delete=models.CASCADE, related_name="experiences")
    title = models.CharField(max_length=200, verbose_name="Poste")
    company = models.CharField(max_length=200, verbose_name="Organisation")
    start_date = models.DateField(verbose_name="Début")
    end_date = models.DateField(null=True, blank=True, verbose_name="Fin")
    is_current = models.BooleanField(default=False, verbose_name="En cours")
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.title} @ {self.company}"


class MemberCertification(TimestampMixin):
    member = models.ForeignKey(MemberProfile, on_delete=models.CASCADE, related_name="certifications")
    title = models.CharField(max_length=200, verbose_name="Titre")
    issuer = models.CharField(max_length=200, verbose_name="Émetteur")
    issued_date = models.DateField(verbose_name="Date d'obtention")
    credential_url = models.URLField(blank=True, verbose_name="Lien de vérification")

    class Meta:
        ordering = ["-issued_date"]

    def __str__(self):
        return f"{self.title} — {self.issuer}"


PLATFORM_CHOICES = [
    ("twitter", "Twitter / X"),
    ("facebook", "Facebook"),
    ("instagram", "Instagram"),
    ("youtube", "YouTube"),
    ("tiktok", "TikTok"),
    ("telegram", "Telegram"),
    ("whatsapp", "WhatsApp"),
    ("other", "Autre"),
]


class SocialLink(models.Model):
    member = models.ForeignKey(MemberProfile, on_delete=models.CASCADE, related_name="social_links")
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    url = models.URLField()

    class Meta:
        unique_together = [("member", "platform")]

    def __str__(self):
        return f"{self.platform}: {self.url}"
