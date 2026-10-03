import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import generics, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from apps.common.permissions import IsAdmin
from .serializers import (
    UserSerializer, UserAdminSerializer, DAHTokenObtainPairSerializer,
    PasswordChangeSerializer, PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer, EmailVerifySerializer, DeleteAccountSerializer,
)
from .services import (
    send_password_reset_email_async, send_verification_email_async,
    verify_user_email, reset_user_password, revoke_all_sessions,
)

User = get_user_model()
logger = logging.getLogger(__name__)

_REFRESH_COOKIE = "refresh_token"
_REFRESH_COOKIE_PATH = "/api/v1/auth/token/refresh/"
_REFRESH_MAX_AGE = 30 * 24 * 60 * 60  # 30 jours


def _set_refresh_cookie(response, token: str) -> None:
    response.set_cookie(
        _REFRESH_COOKIE,
        token,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax",
        max_age=_REFRESH_MAX_AGE,
        path=_REFRESH_COOKIE_PATH,
    )


class DAHTokenObtainPairView(TokenObtainPairView):
    serializer_class = DAHTokenObtainPairSerializer
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            refresh = response.data.pop("refresh", None)
            if refresh:
                _set_refresh_cookie(response, refresh)
            logger.info("Connexion réussie : %s", request.data.get("email"))
        return response


class DAHTokenRefreshView(TokenRefreshView):
    """Lit le refresh token depuis le cookie httpOnly si absent du body."""

    def post(self, request, *args, **kwargs):
        if "refresh" not in request.data:
            cookie_refresh = request.COOKIES.get(_REFRESH_COOKIE)
            if cookie_refresh:
                data = request.data.copy()
                data["refresh"] = cookie_refresh
                request._full_data = data
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            new_refresh = response.data.pop("refresh", None)
            if new_refresh:
                _set_refresh_cookie(response, new_refresh)
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = (
                request.data.get("refresh")
                or request.COOKIES.get(_REFRESH_COOKIE)
            )
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            pass
        logger.info("Déconnexion : %s", request.user.email)
        response = Response(status=status.HTTP_205_RESET_CONTENT)
        response.delete_cookie(_REFRESH_COOKIE, path=_REFRESH_COOKIE_PATH)
        return response


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        # Les autres sessions sont fermées ; celle-ci reçoit un nouveau jeton.
        revoke_all_sessions(request.user)
        logger.info("Mot de passe changé : %s", request.user.email)
        response = Response({"detail": "Mot de passe modifié avec succès."})
        _set_refresh_cookie(response, str(RefreshToken.for_user(request.user)))
        return response


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        try:
            user = User.objects.get(email=email, is_active=True)
            send_password_reset_email_async(user)
        except User.DoesNotExist:
            pass
        # Toujours retourner 200 pour ne pas révéler si l'email existe
        return Response({"detail": "Si cet email existe, un lien de réinitialisation a été envoyé."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            reset_user_password(
                serializer.validated_data["token"],
                serializer.validated_data["new_password"],
            )
        except (ValueError, User.DoesNotExist) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Mot de passe réinitialisé avec succès."})


class EmailVerifyView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = EmailVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = verify_user_email(serializer.validated_data["token"])
            logger.info("Email vérifié : %s", user.email)
        except (ValueError, User.DoesNotExist) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Email vérifié avec succès."})


class ResendVerificationEmailView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.email_verified:
            return Response({"detail": "Votre email est déjà vérifié."}, status=status.HTTP_400_BAD_REQUEST)
        send_verification_email_async(request.user)
        return Response({"detail": "Email de vérification renvoyé."})


class UserAdminViewSet(viewsets.ModelViewSet):
    """Gestion des utilisateurs par un administrateur (édition, désactivation, suppression)."""
    serializer_class = UserAdminSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    http_method_names = ["get", "patch", "delete", "head", "options"]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["role", "is_active"]
    search_fields = ["first_name", "last_name", "email"]
    queryset = User.objects.all().order_by("-created_at")

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            raise ValidationError("Vous ne pouvez pas supprimer votre propre compte.")
        instance.delete()

    def perform_update(self, serializer):
        instance = serializer.instance
        new_role = serializer.validated_data.get("role", instance.role)
        if instance.role == "admin" and new_role != "admin":
            other_admins = User.objects.filter(role="admin").exclude(pk=instance.pk)
            if not other_admins.exists():
                raise ValidationError("Impossible de retirer le dernier administrateur du système.")
        serializer.save()


class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DeleteAccountSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        email = request.user.email
        request.user.delete()
        logger.info("Compte supprimé : %s", email)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(_REFRESH_COOKIE, path=_REFRESH_COOKIE_PATH)
        return response
