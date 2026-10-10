from django.contrib.auth import get_user_model
from rest_framework import serializers
from apps.common.permissions import SECTIONS, has_section
from apps.common.sanitize import clean_rich_text
from apps.departments.services import can_manage_projects, get_department_member_ids
from .models import Project, ProjectTask

User = get_user_model()


class ProjectSerializer(serializers.ModelSerializer):
    """Lecture — ouverte à tout membre connecté."""
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    owner_id = serializers.IntegerField(read_only=True)
    owner_name = serializers.CharField(source="owner.full_name", read_only=True, default=None)
    member_names = serializers.SerializerMethodField()
    department_id = serializers.IntegerField(read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)

    class Meta:
        model = Project
        fields = [
            "id", "title", "description", "status", "status_display",
            "owner_id", "owner_name", "member_names", "department_id", "department_name",
            "deadline", "repository_url", "created_at",
        ]

    def get_member_names(self, obj):
        return [m.full_name for m in obj.members.all()]


class ProjectWriteSerializer(serializers.ModelSerializer):
    """Création/édition — le propriétaire est fixé par la vue (request.user à la
    création), jamais transmis par le client. Un projet est toujours rattaché à un
    département, et ne peut être créé/déplacé que par ceux qui gèrent ses projets
    (responsable/adjoint, gestionnaires de projets, section Départements)."""
    members = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), many=True, required=False)

    class Meta:
        model = Project
        fields = ["title", "description", "status", "department", "deadline", "repository_url", "members"]
        extra_kwargs = {"department": {"required": True, "allow_null": False}}

    def validate(self, attrs):
        is_create = self.instance is None
        if not is_create and "department" not in attrs:
            return attrs  # champ non touché en édition partielle — déjà validé quand il l'a été

        department = attrs.get("department")
        user = self.context["request"].user

        if not can_manage_projects(user, department):
            raise serializers.ValidationError({
                "department": "Vous devez gérer les projets de ce département pour y créer un projet.",
            })

        return attrs


class ProjectTaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True, default=None)
    project_title = serializers.CharField(source="project.title", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    validated_by_name = serializers.CharField(source="validated_by.full_name", read_only=True, default=None)

    class Meta:
        model = ProjectTask
        fields = [
            "id", "project", "project_title", "title", "description",
            "assigned_to", "assigned_to_name", "due_date", "status", "status_display", "weight",
            "submitted_at", "submission_note", "return_reason",
            "validated_at", "validated_by_name", "is_outstanding", "points_awarded", "created_at",
        ]
        read_only_fields = ["id", "project", "project_title", "created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Affichée en HTML : nettoyée aussi à la lecture (anciennes descriptions).
        data["description"] = clean_rich_text(data["description"] or "")
        return data


class ProjectTaskWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectTask
        fields = ["title", "description", "assigned_to", "due_date", "status", "weight"]

    def validate_description(self, value: str) -> str:
        # Éditeur de texte riche : HTML nettoyé (texte brut des anciennes tâches intact).
        return clean_rich_text(value)

    def validate_status(self, value):
        # « À valider » et « Validée » passent par les actions submit / validate.
        if value not in ProjectTask.FREE_STATUSES:
            raise serializers.ValidationError("Statut non modifiable directement.")
        return value

    def validate_assigned_to(self, value):
        if value is None:
            return value
        request = self.context["request"]
        project = self.context["project"]
        if has_section(request.user, SECTIONS.DEPARTMENTS):
            return value
        if value.id not in get_department_member_ids(project.department):
            raise serializers.ValidationError(
                "Vous ne pouvez assigner une tâche qu'à un membre de votre département."
            )
        return value


class ProjectTaskStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ProjectTask.STATUS_CHOICES)
