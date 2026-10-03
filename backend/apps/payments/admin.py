from django.contrib import admin

from .models import CashEntry, Contribution


@admin.register(Contribution)
class ContributionAdmin(admin.ModelAdmin):
    list_display = ("user", "period_start", "months", "amount", "paid_on", "method", "recorded_by")
    list_filter = ("method", "paid_on")
    search_fields = ("user__first_name", "user__last_name", "user__email", "reference")


@admin.register(CashEntry)
class CashEntryAdmin(admin.ModelAdmin):
    list_display = ("date", "kind", "category", "label", "amount", "recorded_by")
    list_filter = ("kind", "category")
    search_fields = ("label", "reference")
