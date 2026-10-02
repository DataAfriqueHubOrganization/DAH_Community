from django.contrib import admin
from .models import Candidature


@admin.register(Candidature)
class CandidatureAdmin(admin.ModelAdmin):
    list_display = ["full_name", "email", "country", "profession", "engagements_summary", "status", "created_at"]
    list_filter = ["status", "country"]
    search_fields = ["first_name", "last_name", "email"]
    readonly_fields = ["reviewed_at", "reviewed_by", "user", "created_at", "updated_at"]

    @admin.display(description="Engagement")
    def engagements_summary(self, obj):
        summary = ", ".join(obj.get_engagements_display())
        if obj.volunteer_poles:
            summary += f" — pôles : {', '.join(obj.get_volunteer_poles_display())}"
        return summary or "—"
