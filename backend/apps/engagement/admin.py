from django.contrib import admin

from .models import Award, CheckIn, PointEntry


@admin.register(PointEntry)
class PointEntryAdmin(admin.ModelAdmin):
    list_display = ["user", "points", "source", "label", "department", "awarded_at", "awarded_by"]
    list_filter = ["source", "department"]
    search_fields = ["user__email", "user__first_name", "user__last_name", "label"]
    date_hierarchy = "awarded_at"


@admin.register(CheckIn)
class CheckInAdmin(admin.ModelAdmin):
    list_display = ["member", "department", "period_label", "status", "points", "confirmed_at"]
    list_filter = ["status", "department"]
    search_fields = ["member__email", "member__first_name", "member__last_name", "period_label"]


@admin.register(Award)
class AwardAdmin(admin.ModelAdmin):
    list_display = ["kind", "period_start", "user", "awarded_by"]
    list_filter = ["kind"]
