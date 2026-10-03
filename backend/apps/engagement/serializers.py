from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.departments.models import Department
from .models import Award, CheckIn

User = get_user_model()


class PeriodQuerySerializer(serializers.Serializer):
    period = serializers.ChoiceField(choices=["month", "quarter", "year"], default="month")
    date = serializers.DateField(required=False)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False)


# ── Points d'étape ────────────────────────────────────────────────────────

class CheckInMemberSerializer(serializers.ModelSerializer):
    """Vue du membre : ses propres réponses et, une fois confirmé, le retour écrit.
    Jamais les scores finaux ni les points (décision interne du responsable)."""
    department_name = serializers.CharField(source="department.name", read_only=True)
    feedback = serializers.SerializerMethodField()

    class Meta:
        model = CheckIn
        fields = [
            "id", "department_name", "period_label", "due_date", "status",
            "self_scores", "improve_self", "department_help", "remark", "submitted_at",
            "feedback", "confirmed_at", "created_at",
        ]

    def get_feedback(self, obj):
        return obj.feedback if obj.status == CheckIn.STATUS_CONFIRMED else ""


class CheckInManagerSerializer(serializers.ModelSerializer):
    """Vue du responsable / bureau : tout, y compris les scores finaux et les points."""
    department_name = serializers.CharField(source="department.name", read_only=True)
    member_id = serializers.IntegerField(read_only=True)
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    launched_by_name = serializers.CharField(source="launched_by.full_name", read_only=True, default=None)
    confirmed_by_name = serializers.CharField(source="confirmed_by.full_name", read_only=True, default=None)

    class Meta:
        model = CheckIn
        fields = [
            "id", "department", "department_name", "member_id", "member_name",
            "launched_by_name", "period_label", "due_date", "status",
            "self_scores", "improve_self", "department_help", "remark", "submitted_at",
            "final_scores", "feedback", "points", "confirmed_by_name", "confirmed_at", "created_at",
        ]


class LaunchCheckInSerializer(serializers.Serializer):
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())
    # Vide = tous les membres du département (hors la personne qui lance).
    members = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    period_label = serializers.CharField(max_length=100)
    due_date = serializers.DateField(required=False, allow_null=True)


class ScoresField(serializers.DictField):
    child = serializers.IntegerField(min_value=1, max_value=5)


class SubmitCheckInSerializer(serializers.Serializer):
    self_scores = ScoresField()
    improve_self = serializers.CharField(allow_blank=True)
    department_help = serializers.CharField(allow_blank=True)
    remark = serializers.CharField(allow_blank=True, required=False, default="")


class ConfirmCheckInSerializer(serializers.Serializer):
    final_scores = ScoresField()
    feedback = serializers.CharField()


# ── Distinctions & ajustements ────────────────────────────────────────────

class AwardSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = Award
        fields = ["id", "user", "user_name", "kind", "period_start", "note", "created_at"]
        read_only_fields = ["id", "user_name", "period_start", "created_at"]


class DesignateAwardSerializer(serializers.Serializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True))
    kind = serializers.ChoiceField(choices=Award.KIND_CHOICES)
    date = serializers.DateField(help_text="N'importe quelle date de la période désignée.")
    note = serializers.CharField(allow_blank=True, required=False, default="")


class AdjustmentSerializer(serializers.Serializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    points = serializers.IntegerField()
    reason = serializers.CharField()
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), required=False, allow_null=True,
    )


# ── Tâches (actions du cycle de validation) ───────────────────────────────

class SubmitTaskSerializer(serializers.Serializer):
    note = serializers.CharField(allow_blank=True, required=False, default="")


class ValidateTaskSerializer(serializers.Serializer):
    outstanding = serializers.BooleanField(required=False, default=False)


class ReturnTaskSerializer(serializers.Serializer):
    reason = serializers.CharField()
