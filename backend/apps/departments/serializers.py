from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from .models import (
    Department, DepartmentMembership, DepartmentAnnouncement, DepartmentSession, DepartmentTask,
)

User = get_user_model()


class DepartmentMembershipSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = DepartmentMembership
        fields = [
            "id", "user_id", "user_full_name", "user_email",
            "start_date", "end_date", "is_current",
        ]

    def get_is_current(self, obj) -> bool:
        today = timezone.now().date()
        return obj.end_date is None or obj.end_date >= today


class AddMembershipSerializer(serializers.Serializer):
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source="user")
    start_date = serializers.DateField(default=timezone.now().date)
    end_date = serializers.DateField(required=False, allow_null=True)


class EndMembershipSerializer(serializers.Serializer):
    end_date = serializers.DateField(required=False, allow_null=True)


class DepartmentListSerializer(serializers.ModelSerializer):
    lead_id = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    co_lead_id = serializers.SerializerMethodField()
    co_lead_name = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    # Résumé pour la liste : ce qui demande une action dans le département.
    activity = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            "id", "name", "description",
            "lead_id", "lead_name", "co_lead_id", "co_lead_name",
            "member_count", "can_manage", "is_member", "activity", "created_at",
        ]

    def get_activity(self, obj) -> dict:
        from apps.projects.models import Project, ProjectTask
        today = timezone.now().date()
        tasks = ProjectTask.objects.filter(project__department=obj)
        return {
            "active_projects": Project.objects.filter(department=obj).exclude(
                status__in=["completed", "archived"]).count(),
            "to_validate": tasks.filter(status="submitted").count(),
            "late": tasks.filter(status__in=["todo", "in_progress", "blocked"], due_date__lt=today).count(),
        }

    def get_lead_id(self, obj) -> int | None:
        return obj.lead_id

    def get_lead_name(self, obj) -> str | None:
        return obj.lead.full_name if obj.lead else None

    def get_co_lead_id(self, obj) -> int | None:
        return obj.co_lead_id

    def get_co_lead_name(self, obj) -> str | None:
        return obj.co_lead.full_name if obj.co_lead else None

    def get_member_count(self, obj) -> int:
        today = timezone.now().date()
        from django.db.models import Q
        return obj.memberships.filter(Q(end_date__isnull=True) | Q(end_date__gte=today)).count()

    def get_can_manage(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        from .services import can_manage_department
        return can_manage_department(request.user, obj)

    def get_is_member(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        from .services import is_current_department_member
        return is_current_department_member(request.user, obj)


class DepartmentDetailSerializer(DepartmentListSerializer):
    memberships = DepartmentMembershipSerializer(many=True, read_only=True)
    project_managers = serializers.SerializerMethodField()
    can_manage_projects = serializers.SerializerMethodField()

    class Meta(DepartmentListSerializer.Meta):
        fields = DepartmentListSerializer.Meta.fields + ["memberships", "project_managers", "can_manage_projects"]

    def get_project_managers(self, obj):
        return [{"id": u.id, "full_name": u.full_name} for u in obj.project_managers.order_by("first_name", "last_name")]

    def get_can_manage_projects(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        from .services import can_manage_projects
        return can_manage_projects(request.user, obj)


class ProjectManagerSerializer(serializers.Serializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True))


class DepartmentWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["name", "description", "lead", "co_lead"]

    def validate(self, attrs):
        lead = attrs.get("lead", getattr(self.instance, "lead", None))
        co_lead = attrs.get("co_lead", getattr(self.instance, "co_lead", None))

        if lead and co_lead and lead.id == co_lead.id:
            raise serializers.ValidationError(
                "Le responsable et l'adjoint ne peuvent pas être la même personne."
            )

        other_departments = Department.objects.all()
        if self.instance:
            other_departments = other_departments.exclude(pk=self.instance.pk)

        for person, label in ((lead, "responsable"), (co_lead, "adjoint")):
            if person and other_departments.filter(
                Q(lead=person) | Q(co_lead=person)
            ).exists():
                raise serializers.ValidationError(
                    f"{person.full_name} est déjà responsable ou adjoint d'un autre "
                    f"département — impossible de le désigner {label} ici aussi."
                )

        return attrs


class DepartmentAnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.full_name", read_only=True, default=None)

    class Meta:
        model = DepartmentAnnouncement
        fields = ["id", "title", "content", "author_name", "created_at"]


class AnnouncementWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=300)
    content = serializers.CharField()


class DepartmentSessionSerializer(serializers.ModelSerializer):
    present_member_ids = serializers.PrimaryKeyRelatedField(
        source="present_members", many=True, read_only=True,
    )
    present_count = serializers.IntegerField(source="present_members.count", read_only=True)
    frequency_display = serializers.CharField(source="get_frequency_display", read_only=True)

    class Meta:
        model = DepartmentSession
        fields = [
            "id", "date", "theme", "meet_link", "frequency", "frequency_display", "series_id",
            "report", "present_member_ids", "present_count", "created_at",
        ]


class SessionWriteSerializer(serializers.Serializer):
    date = serializers.DateField()
    theme = serializers.CharField(max_length=300, required=False, allow_blank=True)
    meet_link = serializers.URLField(required=False, allow_blank=True)
    frequency = serializers.ChoiceField(
        choices=DepartmentSession.FREQUENCY_CHOICES, required=False, default="none",
    )
    occurrences = serializers.IntegerField(required=False, min_value=1, max_value=52, default=1)


class SessionUpdateSerializer(serializers.Serializer):
    date = serializers.DateField(required=False)
    theme = serializers.CharField(max_length=300, required=False, allow_blank=True)
    meet_link = serializers.URLField(required=False, allow_blank=True)


class SessionReportSerializer(serializers.Serializer):
    report = serializers.CharField(allow_blank=True)
    present_user_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), many=True, required=False, default=list,
    )


class DepartmentTaskSerializer(serializers.ModelSerializer):
    assigned_to_id = serializers.IntegerField(source="assigned_to.id", read_only=True, default=None)
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = DepartmentTask
        fields = [
            "id", "title", "description", "assigned_to_id", "assigned_to_name",
            "due_date", "status", "status_display", "weight",
            "submitted_at", "submission_note", "return_reason",
            "validated_at", "is_outstanding", "points_awarded", "created_at",
        ]


class TaskWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=300)
    description = serializers.CharField(required=False, allow_blank=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="assigned_to", required=False, allow_null=True,
    )
    due_date = serializers.DateField(required=False, allow_null=True)
    # « À valider » / « Validée » : uniquement via les actions submit / validate.
    status = serializers.ChoiceField(choices=DepartmentTask.FREE_STATUSES, required=False)
    weight = serializers.IntegerField(min_value=DepartmentTask.WEIGHT_MIN, max_value=DepartmentTask.WEIGHT_MAX, required=False)


class TaskStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=DepartmentTask.STATUS_CHOICES)
