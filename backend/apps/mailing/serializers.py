from django.db.models import Count, Q
from django.utils.html import strip_tags
from rest_framework import serializers

from apps.common.sanitize import clean_html
from apps.departments.models import Department

from .models import AUDIENCES, MemberEmail, MemberEmailRecipient

TEMPLATES = ["annonce", "convocation", "volontaires", "felicitations", "libre"]


class EmailContentSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=150)
    body = serializers.CharField(max_length=20000)
    cta_label = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    cta_url = serializers.URLField(required=False, allow_blank=True, default="")

    def validate_body(self, value: str) -> str:
        value = clean_html(value)
        if not strip_tags(value).strip():
            raise serializers.ValidationError("Le message est vide.")
        return value

    def validate(self, attrs):
        if attrs.get("cta_url") and not attrs.get("cta_label", "").strip():
            raise serializers.ValidationError({"cta_label": "Indiquez le texte du bouton."})
        if not attrs.get("cta_url"):
            attrs["cta_label"] = ""
        return attrs


class SendMemberEmailSerializer(EmailContentSerializer):
    template = serializers.ChoiceField(choices=TEMPLATES, required=False, allow_blank=True, default="")
    audience = serializers.ChoiceField(choices=AUDIENCES.CHOICES, required=False, default=AUDIENCES.SELECTION)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False, allow_null=True)
    user_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False,
                                     default=list, max_length=1000)
    test = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs["test"]:
            return attrs
        if attrs["audience"] == AUDIENCES.DEPARTMENT and not attrs.get("department"):
            raise serializers.ValidationError({"department": "Choisissez un département."})
        if attrs["audience"] == AUDIENCES.SELECTION and not attrs["user_ids"]:
            raise serializers.ValidationError({"user_ids": "Choisissez au moins un membre."})
        return attrs


class MemberEmailListSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.CharField(source="sent_by.full_name", read_only=True, default=None)
    total = serializers.IntegerField(read_only=True)
    sent = serializers.IntegerField(read_only=True)
    failed = serializers.IntegerField(read_only=True)
    pending = serializers.IntegerField(read_only=True)

    class Meta:
        model = MemberEmail
        fields = ["id", "subject", "template", "audience", "audience_label", "sent_by_name", "created_at",
                  "total", "sent", "failed", "pending"]

    @staticmethod
    def annotate(queryset):
        status = MemberEmailRecipient.STATUS
        return queryset.select_related("sent_by").annotate(
            total=Count("recipients"),
            sent=Count("recipients", filter=Q(recipients__status=status.SENT)),
            failed=Count("recipients", filter=Q(recipients__status=status.FAILED)),
            pending=Count("recipients", filter=Q(recipients__status=status.PENDING)),
        )


class RecipientSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberEmailRecipient
        fields = ["id", "address", "first_name", "last_name", "status", "error", "sent_at"]


class MemberEmailDetailSerializer(MemberEmailListSerializer):
    recipients = RecipientSerializer(many=True, read_only=True)

    class Meta(MemberEmailListSerializer.Meta):
        fields = MemberEmailListSerializer.Meta.fields + ["body", "cta_label", "cta_url", "recipients"]


class MailableMemberSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField()
    poste = serializers.CharField(allow_null=True)
