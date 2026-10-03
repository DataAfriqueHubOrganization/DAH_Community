from rest_framework import serializers
from .models import MemberProfile, MemberExperience, MemberCertification, SocialLink


class MemberExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberExperience
        fields = ["id", "title", "company", "start_date", "end_date", "is_current", "description"]


class MemberCertificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberCertification
        fields = ["id", "title", "issuer", "issued_date", "credential_url"]


class SocialLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialLink
        fields = ["id", "platform", "url"]


class MemberProfileSerializer(serializers.ModelSerializer):
    experiences = MemberExperienceSerializer(many=True, read_only=True)
    certifications = MemberCertificationSerializer(many=True, read_only=True)
    social_links = SocialLinkSerializer(many=True, read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_first_name = serializers.CharField(source="user.first_name", read_only=True)
    user_last_name = serializers.CharField(source="user.last_name", read_only=True)
    user_avatar = serializers.ImageField(source="user.avatar", read_only=True)
    user_role = serializers.CharField(source="user.role", read_only=True)

    class Meta:
        model = MemberProfile
        fields = [
            "id", "slug", "bio", "skills",
            "github_url", "linkedin_url", "website_url", "cv",
            "is_public", "member_number", "created_at", "updated_at",
            "user_email", "user_first_name", "user_last_name", "user_avatar", "user_role",
            "experiences", "certifications", "social_links",
        ]
        read_only_fields = ["id", "slug", "member_number", "created_at", "updated_at"]


class PublicMemberProfileSerializer(serializers.ModelSerializer):
    experiences = MemberExperienceSerializer(many=True, read_only=True)
    certifications = MemberCertificationSerializer(many=True, read_only=True)
    social_links = SocialLinkSerializer(many=True, read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    avatar = serializers.ImageField(source="user.avatar", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
    poste = serializers.CharField(source="user.poste", read_only=True)
    department = serializers.SerializerMethodField()
    awards = serializers.SerializerMethodField()

    class Meta:
        model = MemberProfile
        fields = [
            "slug", "bio", "skills",
            "github_url", "linkedin_url", "website_url",
            "first_name", "last_name", "avatar", "role", "poste", "department",
            "experiences", "certifications", "social_links", "awards",
        ]

    def get_department(self, obj):
        from apps.departments.services import get_department_dict
        return get_department_dict(obj.user)

    def get_awards(self, obj):
        """Distinctions « Membre du mois / de l'année » (badges du profil public)."""
        return list(obj.user.awards.order_by("-period_start").values("kind", "period_start"))


class MemberListSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    avatar = serializers.ImageField(source="user.avatar", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
    poste = serializers.CharField(source="user.poste", read_only=True)
    is_active = serializers.BooleanField(source="user.is_active", read_only=True)
    department = serializers.SerializerMethodField()

    class Meta:
        model = MemberProfile
        fields = [
            "id", "user_id", "slug", "first_name", "last_name", "email",
            "avatar", "role", "poste", "is_active", "skills", "member_number", "department",
        ]

    def get_department(self, obj):
        from apps.departments.services import get_department_dict
        return get_department_dict(obj.user)


class PublicMemberListSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    avatar = serializers.ImageField(source="user.avatar", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
    poste = serializers.CharField(source="user.poste", read_only=True)
    current_job = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()

    class Meta:
        model = MemberProfile
        fields = ["slug", "first_name", "last_name", "avatar", "role", "poste", "skills", "current_job", "department"]

    def get_department(self, obj):
        from apps.departments.services import get_department_dict
        return get_department_dict(obj.user)

    def get_current_job(self, obj):
        exp = obj.experiences.filter(is_current=True).first()
        if exp:
            return {"title": exp.title, "company": exp.company}
        return None
