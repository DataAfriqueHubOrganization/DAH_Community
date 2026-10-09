from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import ROLES, SECTIONS

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    department = serializers.SerializerMethodField()
    # Sections de gestion ouvertes à l'utilisateur (toutes pour l'admin) : menu du site.
    sections = serializers.ListField(source="granted_sections", child=serializers.CharField(), read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name",
            "phone", "avatar", "role", "poste", "department", "sections", "email_verified", "created_at",
        ]
        read_only_fields = ["id", "email", "role", "poste", "department", "email_verified", "created_at"]

    def get_department(self, obj):
        from apps.departments.services import get_department_dict
        return get_department_dict(obj)


class UserAdminSerializer(serializers.ModelSerializer):
    """Édition d'un utilisateur par un administrateur — expose role/poste/is_active/email.
    `department_id` est un pass-through en écriture (pas un champ du modèle User) : le
    département est une adhésion datée (DepartmentMembership), gérée via
    apps.departments.services.add_member/end_membership dans .update()."""
    full_name = serializers.CharField(read_only=True)
    department = serializers.SerializerMethodField()
    department_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    sections = serializers.ListField(
        child=serializers.ChoiceField(choices=SECTIONS.CHOICES), required=False, max_length=len(SECTIONS.KEYS),
    )

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name",
            "phone", "role", "poste", "department", "department_id", "sections",
            "is_active", "email_verified", "created_at",
        ]
        read_only_fields = ["id", "email_verified", "created_at"]

    def get_department(self, obj):
        from apps.departments.services import get_department_dict
        return get_department_dict(obj)

    def validate(self, attrs):
        role = attrs.get("role", getattr(self.instance, "role", None))
        sections = attrs.get("sections")
        if sections is not None:
            # Ordre stable, sans doublon.
            attrs["sections"] = [key for key in SECTIONS.KEYS if key in sections]
        if role in (ROLES.VISITEUR, ROLES.CANDIDAT):
            if attrs.get("sections"):
                raise serializers.ValidationError(
                    {"sections": "Les accès ne peuvent être accordés qu'à un membre actif."})
            attrs["sections"] = []  # un compte qui redevient visiteur/candidat perd ses accès
        elif role == ROLES.ADMIN:
            attrs["sections"] = []  # l'admin a déjà tout
        return attrs

    def update(self, instance, validated_data):
        department_id = validated_data.pop("department_id", serializers.empty)
        user = super().update(instance, validated_data)

        if department_id is not serializers.empty:
            from django.utils import timezone
            from apps.departments.models import Department
            from apps.departments.services import get_current_membership, add_member, end_membership

            current = get_current_membership(user)
            if department_id is None:
                if current:
                    end_membership(current)
            elif not current or current.department_id != department_id:
                department = Department.objects.get(pk=department_id)
                add_member(department, user, start_date=timezone.now().date())

        return user


class DAHTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["poste"] = user.poste
        token["email_verified"] = user.email_verified
        token["full_name"] = user.full_name
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.email_verified:
            # Première connexion : se connecter avec le mot de passe reçu par email
            # prouve que l'adresse est valide — le compte est activé automatiquement,
            # sans email de vérification. Tokens régénérés pour refléter le statut.
            from .services import mark_email_verified
            mark_email_verified(self.user)
            refresh = self.get_token(self.user)
            data["refresh"] = str(refresh)
            data["access"] = str(refresh.access_token)
        data["user"] = UserSerializer(self.user).data
        return data


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Les mots de passe ne correspondent pas."})
        return attrs

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Mot de passe actuel incorrect.")
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])
    new_password_confirm = serializers.CharField()

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Les mots de passe ne correspondent pas."})
        return attrs


class EmailVerifySerializer(serializers.Serializer):
    token = serializers.CharField()


class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Mot de passe incorrect.")
        return value
