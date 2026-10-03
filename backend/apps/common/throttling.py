from django.conf import settings
from rest_framework.permissions import SAFE_METHODS
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle


class ClientIPMixin:
    """IP du visiteur pour les quotas.

    CLIENT_IP_HEADER désigne l'en-tête posé par le proxy de confiance placé
    devant l'application (Cloudflare sur Render : HTTP_CF_CONNECTING_IP ; nginx
    sur un serveur : HTTP_X_REAL_IP). Il ne doit être défini que si ce proxy
    remplace toujours la valeur envoyée par le client — sinon n'importe qui
    pourrait choisir son IP et contourner les quotas. Par défaut : REMOTE_ADDR
    / X-Forwarded-For selon NUM_PROXIES (comportement standard de DRF)."""

    def get_ident(self, request):
        header = getattr(settings, "CLIENT_IP_HEADER", None)
        if header:
            ip = request.META.get(header, "").strip()
            if ip:
                return ip
        return super().get_ident(request)


class ClientAnonRateThrottle(ClientIPMixin, AnonRateThrottle):
    pass


class ClientUserRateThrottle(ClientIPMixin, UserRateThrottle):
    pass


class ClientScopedRateThrottle(ClientIPMixin, ScopedRateThrottle):
    pass


class WriteScopedRateThrottle(ClientScopedRateThrottle):
    """Quota `throttle_scope` appliqué uniquement aux envois (POST, PATCH…) :
    la lecture d'une même ressource reste libre."""

    def allow_request(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return super().allow_request(request, view)


WRITE_THROTTLES = [ClientAnonRateThrottle, ClientUserRateThrottle, WriteScopedRateThrottle]
