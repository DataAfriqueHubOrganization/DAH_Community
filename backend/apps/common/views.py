import mimetypes

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from django.views.decorators.http import require_GET

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
