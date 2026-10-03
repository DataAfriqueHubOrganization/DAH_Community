from rest_framework import serializers
from .models import EventReminder, Event, EventParticipant, EventSpeaker


class EventSpeakerSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventSpeaker
        fields = ["id", "name", "bio", "photo", "user"]


class EventListSerializer(serializers.ModelSerializer):
    participant_count = serializers.ReadOnlyField()
    is_full = serializers.ReadOnlyField()
    is_registered = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id", "title", "event_type", "cover_image", "recap_image",
            "start_date", "end_date", "registration_deadline",
            "location", "online_link", "is_published",
            "participant_count", "max_participants", "is_full", "is_registered",
        ]

    def get_is_registered(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.participants.filter(user=request.user).exists()


class EventDetailSerializer(serializers.ModelSerializer):
    speakers = EventSpeakerSerializer(many=True, read_only=True)
    participant_count = serializers.ReadOnlyField()
    is_full = serializers.ReadOnlyField()
    is_registered = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)

    class Meta:
        model = Event
        fields = [
            "id", "title", "description", "event_type", "cover_image", "recap_image",
            "start_date", "end_date", "registration_deadline",
            "location", "online_link", "max_participants",
            "is_published", "qr_code", "created_by_name", "created_at",
            "speakers", "participant_count", "is_full", "is_registered",
        ]

    def get_is_registered(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.participants.filter(user=request.user).exists()


class EventWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = [
            # id renvoyé après création : l'éditeur enchaîne sur la page de modification.
            "id", "title", "description", "event_type", "cover_image", "recap_image",
            "start_date", "end_date", "registration_deadline",
            "location", "online_link", "max_participants", "is_published",
        ]
        read_only_fields = ["id"]


class EventParticipantSerializer(serializers.ModelSerializer):
    user_id = serializers.SerializerMethodField()
    user_email = serializers.EmailField(source="email", read_only=True)
    user_first_name = serializers.CharField(source="first_name", read_only=True)
    user_last_name = serializers.CharField(source="last_name", read_only=True)

    class Meta:
        model = EventParticipant
        fields = [
            "id", "user_id", "user_email", "user_first_name", "user_last_name",
            "nationality", "organisation", "profession",
            "created_at", "presence_validated", "attended_at", "motivation",
        ]

    def get_user_id(self, obj) -> int | None:
        return obj.user_id


class RegisterForEventSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    nationality = serializers.CharField(max_length=100)
    organisation = serializers.CharField(max_length=200)
    profession = serializers.CharField(max_length=150)
    motivation = serializers.CharField()

    def validate_email(self, value: str) -> str:
        return value.strip().lower()


class ParticipantLookupSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value: str) -> str:
        return value.strip().lower()


class EventReminderSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.CharField(source="sent_by.full_name", read_only=True, default=None)

    class Meta:
        model = EventReminder
        fields = ["id", "subject", "message", "sent_by_name", "sent_at", "recipients"]


class SendEventReminderSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=150)
    message = serializers.CharField(max_length=5000)
    test = serializers.BooleanField(required=False, default=False)


class ParticipantWithEventSerializer(EventParticipantSerializer):
    """Inscription vue depuis la liste de tous les participants (avec son événement)."""
    event_id = serializers.UUIDField(source="event.id", read_only=True)
    event_title = serializers.CharField(source="event.title", read_only=True)
    event_start_date = serializers.DateTimeField(source="event.start_date", read_only=True)

    class Meta(EventParticipantSerializer.Meta):
        fields = EventParticipantSerializer.Meta.fields + ["event_id", "event_title", "event_start_date"]


class ParticipantsFilterSerializer(serializers.Serializer):
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    # Identifiants d'événements séparés par des virgules.
    events = serializers.CharField(required=False, allow_blank=True)
    group = serializers.ChoiceField(choices=["registration", "person"], required=False, default="registration")

    def validate_events(self, value):
        import uuid
        ids = [v.strip() for v in value.split(",") if v.strip()]
        try:
            return [uuid.UUID(v) for v in ids]
        except ValueError:
            raise serializers.ValidationError("Identifiant d'événement invalide.")

    def validate(self, attrs):
        if attrs.get("date_from") and attrs.get("date_to") and attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError({"date_to": "La date de fin précède la date de début."})
        return attrs
