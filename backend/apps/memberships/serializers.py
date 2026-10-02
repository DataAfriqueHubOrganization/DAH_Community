from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Candidature

User = get_user_model()


MAX_CV_SIZE = 5 * 1024 * 1024  # 5 Mo


class CandidatureCreateSerializer(serializers.ModelSerializer):
    # ListField lit aussi les clés répétées d'un envoi multipart (avec CV).
    engagements = serializers.ListField(
        child=serializers.ChoiceField(choices=Candidature.ENGAGEMENT_CHOICES),
        allow_empty=False,
        error_messages={"empty": "Indiquez au moins une façon de vous impliquer."},
    )
    volunteer_poles = serializers.ListField(
        child=serializers.ChoiceField(choices=Candidature.POLE_CHOICES),
        required=False,
        default=list,
    )

    class Meta:
        model = Candidature
        fields = [
            "first_name", "last_name", "email", "phone",
            "country", "profession", "linkedin_url", "motivation", "cv",
            "engagements", "volunteer_poles",
        ]
        # Le champ email est unique en base ; on désactive le UniqueValidator
        # automatique de DRF pour appliquer notre propre règle métier ci-dessous
        # (une resoumission après refus doit être autorisée, pas bloquée).
        extra_kwargs = {"email": {"validators": []}, "cv": {"required": False}}

    def validate_cv(self, value):
        if value and value.size > MAX_CV_SIZE:
            raise serializers.ValidationError("Le CV ne doit pas dépasser 5 Mo.")
        return value

    def validate(self, attrs):
        # Dédoublonnage en conservant l'ordre d'affichage des choix.
        engagements = [k for k, _ in Candidature.ENGAGEMENT_CHOICES if k in attrs.get("engagements", [])]
        poles = [k for k, _ in Candidature.POLE_CHOICES if k in attrs.get("volunteer_poles", [])]
        if Candidature.ENGAGEMENT_VOLUNTEER in engagements:
            if not poles:
                raise serializers.ValidationError(
                    {"volunteer_poles": "Choisissez au moins un pôle pour le bénévolat."}
                )
        else:
            poles = []  # pôles ignorés si le bénévolat n'est pas coché
        attrs["engagements"] = engagements
        attrs["volunteer_poles"] = poles
        return attrs

    def validate_email(self, value):
        # Un compte utilisateur peut exister sans que la personne soit membre : le rôle
        # (pas la simple présence du compte) fait foi — un admin peut avoir révoqué le
        # statut de membre (rôle repassé à visiteur/candidat) directement depuis /manage/members.
        user = User.objects.filter(email=value).first()
        if user and user.is_member:
            raise serializers.ValidationError(
                "Cette adresse email est déjà associée à un membre de Data Afrique Hub."
            )
        if Candidature.objects.filter(email=value, status=Candidature.STATUS_PENDING).exists():
            raise serializers.ValidationError(
                "Une candidature est déjà en cours de traitement avec cet email."
            )
        return value

    def create(self, validated_data):
        # Resoumission après un refus, ou après une perte de statut de membre : on met
        # à jour la candidature existante plutôt que d'en créer une nouvelle (contrainte
        # unique sur l'email). validate_email a déjà écarté les cas encore bloquants.
        existing = (
            Candidature.objects.filter(email=validated_data["email"])
            .exclude(status=Candidature.STATUS_PENDING)
            .first()
        )
        if existing:
            for field, value in validated_data.items():
                setattr(existing, field, value)
            existing.status = Candidature.STATUS_PENDING
            existing.rejection_reason = ""
            existing.reviewed_at = None
            existing.reviewed_by = None
            existing.save()
            return existing
        return super().create(validated_data)


class CandidatureListSerializer(serializers.ModelSerializer):
    reviewed_by_name = serializers.CharField(source="reviewed_by.full_name", read_only=True, default=None)

    class Meta:
        model = Candidature
        fields = [
            "id", "first_name", "last_name", "email", "country",
            "profession", "engagements", "volunteer_poles",
            "status", "created_at", "reviewed_at", "reviewed_by_name",
        ]


class CandidatureDetailSerializer(serializers.ModelSerializer):
    reviewed_by_name = serializers.CharField(source="reviewed_by.full_name", read_only=True, default=None)
    cv = serializers.FileField(read_only=True)

    class Meta:
        model = Candidature
        fields = [
            "id", "first_name", "last_name", "email", "phone", "country",
            "profession", "linkedin_url", "motivation", "cv",
            "engagements", "volunteer_poles", "status",
            "rejection_reason", "reviewed_at", "reviewed_by_name", "created_at",
        ]


class ReviewCandidatureSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["accept", "reject"])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["action"] == "reject" and not attrs.get("rejection_reason", "").strip():
            raise serializers.ValidationError(
                {"rejection_reason": "Le motif de refus est obligatoire."}
            )
        return attrs
