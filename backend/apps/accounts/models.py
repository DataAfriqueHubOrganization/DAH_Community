from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from apps.common.mixins import TimestampMixin
from apps.common.validators import MaxFileSizeValidator
from django.core.validators import FileExtensionValidator


class ROLES:
    """Rôle d'accès — gouverne les permissions."""
    ADMIN = "admin"
    RESPONSABLE = "responsable"
    MEMBRE = "membre"
    CANDIDAT = "candidat"
    VISITEUR = "visiteur"

    CHOICES = [
        (ADMIN, "Administrateur"),
        (RESPONSABLE, "Responsable"),
        (MEMBRE, "Membre"),
        (CANDIDAT, "Candidat"),
        (VISITEUR, "Visiteur"),
    ]


class POSTES:
    """Poste au bureau — purement informatif, sans impact sur les permissions."""
    PRESIDENT = "president"
    VP1 = "vp1"
    VP2 = "vp2"
    SECRETAIRE_GENERAL = "secretaire_general"
    SECRETAIRE_GENERAL_ADJ = "secretaire_general_adj"
    TRESORIER = "tresorier"
    TRESORIER_ADJ = "tresorier_adj"

    CHOICES = [
        (PRESIDENT, "Président"),
        (VP1, "Vice-Président 1"),
        (VP2, "Vice-Président 2"),
        (SECRETAIRE_GENERAL, "Secrétaire Général"),
        (SECRETAIRE_GENERAL_ADJ, "Secrétaire Général Adjoint"),
        (TRESORIER, "Trésorier Général"),
        (TRESORIER_ADJ, "Trésorier Général Adjoint"),
    ]


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("L'adresse email est obligatoire.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", ROLES.ADMIN)
        extra_fields.setdefault("email_verified", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, TimestampMixin):
    email = models.EmailField(unique=True, verbose_name="Adresse email")
    first_name = models.CharField(max_length=100, verbose_name="Prénom")
    last_name = models.CharField(max_length=100, verbose_name="Nom")
    phone = models.CharField(max_length=20, blank=True, verbose_name="Téléphone")
    avatar = models.ImageField(
        upload_to="avatars/", null=True, blank=True, verbose_name="Photo",
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"]), MaxFileSizeValidator(5)],
    )
    role = models.CharField(
        max_length=30,
        choices=ROLES.CHOICES,
        default=ROLES.VISITEUR,
        verbose_name="Rôle",
    )
    poste = models.CharField(
        max_length=30,
        choices=POSTES.CHOICES,
        null=True,
        blank=True,
        default=None,
        verbose_name="Poste au bureau",
    )
    email_verified = models.BooleanField(default=False, verbose_name="Email vérifié")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} <{self.email}>"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def is_bureau(self):
        return self.poste is not None or self.role == ROLES.ADMIN

    @property
    def is_admin(self):
        return self.role == ROLES.ADMIN

    @property
    def is_member(self):
        """Un membre est un utilisateur dont la candidature a été acceptée et qui n'a
        pas perdu ce statut depuis (rôle repassé à visiteur/candidat par un admin)."""
        return self.role not in (ROLES.VISITEUR, ROLES.CANDIDAT)
