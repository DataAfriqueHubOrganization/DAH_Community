import mimetypes

from django.conf import settings
from django.core.cache import cache
from django.http import FileResponse, Http404, HttpResponse
from django.views.decorators.http import require_GET
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .storage import PrivateFileSystemStorage, read_private_token


@require_GET
def private_file(request):
    """Document privé via un lien signé et expirant.

    Le lien n'est produit que dans les réponses de l'API déjà réservées aux
    personnes autorisées (le membre lui-même, la trésorerie, le bureau…)."""
    try:
        name = read_private_token(request.GET.get("t", ""))
    except ValueError:
        raise Http404("Lien invalide ou expiré.")

    storage = PrivateFileSystemStorage()
    try:
        exists = storage.exists(name)  # chemin vérifié : pas de sortie du dossier privé
    except Exception:
        raise Http404
    if not exists:
        raise Http404

    content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
    accel = settings.PRIVATE_MEDIA_ACCEL_REDIRECT
    if accel:
        # nginx envoie le fichier lui-même (emplacement « internal »).
        response = HttpResponse(content_type=content_type)
        response["X-Accel-Redirect"] = f"{accel.rstrip('/')}/{name}"
    else:
        response = FileResponse(storage.open(name, "rb"), content_type=content_type)
    response["Content-Disposition"] = "inline"
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    if content_type != "application/pdf":
        # Aucun script exécutable (le lecteur PDF des navigateurs refuse ce mode,
        # d'où l'exception ; les formats acceptés se limitent à PDF et images).
        response["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src 'self'"
    return response


_STATS_CACHE_KEY = "public-stats"


@api_view(["GET"])
@permission_classes([AllowAny])
def public_stats(request):
    """Chiffres de la page d'accueil, calculés depuis la base (mis en cache 10 min) :
    membres actifs, personnes venues à nos événements, pays représentés."""
    stats = cache.get(_STATS_CACHE_KEY)
    if stats is None:
        from apps.events.models import EventParticipant
        from apps.memberships.models import Candidature
        from apps.payments.services import liable_members

        countries = {
            c.strip().lower()
            for c in [*EventParticipant.objects.values_list("nationality", flat=True),
                      *Candidature.objects.values_list("country", flat=True)]
            if c and c.strip()
        }
        stats = {
            "members": liable_members().count(),
            "participants": EventParticipant.objects.values("email").distinct().count(),
            "countries": len(countries),
        }
        cache.set(_STATS_CACHE_KEY, stats, 600)
    return Response(stats)
