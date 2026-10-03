from django.contrib import admin

from .models import EventReminder


@admin.register(EventReminder)
class EventReminderAdmin(admin.ModelAdmin):
    list_display = ("event", "subject", "sent_at", "sent_by", "recipients")
    search_fields = ("event__title", "subject")
