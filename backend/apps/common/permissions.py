from rest_framework.permissions import BasePermission

from apps.accounts.models import SECTIONS  # noqa: F401 — réexporté pour les vues


def has_section(user, key: str) -> bool:
    """Accès à une section de gestion (voir User.has_section) : tout pour l'admin,
    sinon seulement les sections accordées dans Gestion des accès."""
    return bool(user and user.is_authenticated and user.has_section(key))


def HasSection(key: str):  # noqa: N802 — s'emploie comme une classe de permission
    """Permission DRF : HasSection(SECTIONS.EVENTS)."""
    class _HasSection(BasePermission):
        message = "Vous n'avez pas accès à cette section. Demandez-le à l'administrateur."

        def has_permission(self, request, view):
            return has_section(request.user, key)

    _HasSection.__name__ = f"HasSection[{key}]"
    return _HasSection


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "admin")


class IsMembre(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role == "membre"
        )
