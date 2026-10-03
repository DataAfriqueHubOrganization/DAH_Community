from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import CashEntry, Contribution


class MonthField(serializers.DateField):
    """Accepte YYYY-MM ou YYYY-MM-DD ; renvoie le 1er du mois."""

    def to_internal_value(self, value):
        if isinstance(value, str) and len(value) == 7:
            value = f"{value}-01"
        return super().to_internal_value(value).replace(day=1)


class ContributionSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    recorded_by_name = serializers.CharField(source="recorded_by.full_name", read_only=True, default=None)
    period_end = serializers.SerializerMethodField()
    points = serializers.SerializerMethodField()

    class Meta:
        model = Contribution
        fields = [
            "id", "user", "user_name", "period_start", "period_end", "months", "monthly_rate", "amount",
            "paid_on", "method", "method_display", "reference", "note", "recorded_by_name", "points", "created_at",
        ]

    def get_period_end(self, obj):
        from .services import add_months
        return add_months(obj.period_start, obj.months - 1)

    def get_points(self, obj):
        from .services import POINTS_PER_MONTH
        return POINTS_PER_MONTH * obj.months


class RecordContributionSerializer(serializers.Serializer):
    user = serializers.PrimaryKeyRelatedField(queryset=get_user_model().objects.all())
    period_start = MonthField()
    months = serializers.IntegerField(min_value=1)
    paid_on = serializers.DateField()
    method = serializers.ChoiceField(choices=Contribution.METHOD_CHOICES)
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    note = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")


class CashEntrySerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    recorded_by_name = serializers.CharField(source="recorded_by.full_name", read_only=True, default=None)
    is_contribution = serializers.SerializerMethodField()

    class Meta:
        model = CashEntry
        fields = [
            "id", "kind", "kind_display", "category", "category_display", "label", "amount", "date",
            "method", "method_display", "reference", "note", "attachment", "is_contribution",
            "recorded_by_name", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_is_contribution(self, obj):
        return obj.contribution_id is not None

    def validate(self, attrs):
        kind = attrs.get("kind", getattr(self.instance, "kind", None))
        category = attrs.get("category", getattr(self.instance, "category", None))
        allowed = dict(CashEntry.INCOME_CATEGORIES if kind == CashEntry.KIND_INCOME else CashEntry.EXPENSE_CATEGORIES)
        if category not in allowed:
            raise serializers.ValidationError({"category": "Catégorie incompatible avec le type d'écriture."})
        if category == CashEntry.CATEGORY_CONTRIBUTIONS:
            raise serializers.ValidationError({"category": "Les cotisations s'enregistrent depuis l'onglet Cotisations."})
        if attrs.get("amount") == 0:
            raise serializers.ValidationError({"amount": "Le montant doit être positif."})
        return attrs


class YearQuerySerializer(serializers.Serializer):
    year = serializers.IntegerField(min_value=2000, max_value=2100, required=False)
