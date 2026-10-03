from django.conf import settings
from django.http import JsonResponse


class MaxRequestSizeMiddleware:
    """Refuse d'emblée les requêtes trop lourdes (413) avant de lire le corps :
    Django ne limite pas la taille des fichiers envoyés."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.limit = getattr(settings, "MAX_REQUEST_BYTES", 20 * 1024 * 1024)

    def __call__(self, request):
        try:
            length = int(request.META.get("CONTENT_LENGTH") or 0)
        except ValueError:
            length = 0
        if length > self.limit:
            return JsonResponse(
                {"error": True, "status_code": 413, "detail": "Envoi trop volumineux."}, status=413,
            )
        return self.get_response(request)
