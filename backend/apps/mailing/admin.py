from django.contrib import admin

from .models import DailyEmailCount, MemberEmail, MemberEmailRecipient, NewsletterSubscriber


class RecipientInline(admin.TabularInline):
    model = MemberEmailRecipient
    extra = 0
    fields = ["address", "first_name", "last_name", "status", "error", "sent_at"]
    readonly_fields = fields
    can_delete = False


@admin.register(MemberEmail)
class MemberEmailAdmin(admin.ModelAdmin):
    list_display = ["subject", "audience_label", "sent_by", "created_at"]
    readonly_fields = ["subject", "body", "template", "cta_label", "cta_url", "audience", "audience_label", "sent_by", "created_at"]
    inlines = [RecipientInline]


@admin.register(DailyEmailCount)
class DailyEmailCountAdmin(admin.ModelAdmin):
    list_display = ["day", "count"]


@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display = ["email", "is_active", "source", "created_at"]
    list_filter = ["is_active", "source"]
    search_fields = ["email"]
