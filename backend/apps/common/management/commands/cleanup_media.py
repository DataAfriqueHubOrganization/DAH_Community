"""Remet les fichiers en ordre après le passage au stockage sur le serveur.

    python manage.py cleanup_media --dry-run   # voir ce qui serait fait
    python manage.py cleanup_media

1. Les documents sensibles (CV, preuves, justificatifs) encore rangés dans le
   dossier public sont déplacés dans le dossier privé.
2. Les références à des fichiers introuvables (anciens fichiers Cloudinary,
   abandonnés) sont vidées : le site affiche alors l'image par défaut au lieu
   d'une image cassée, et chacun peut renvoyer son fichier.

Relançable sans risque.
"""
from django.apps import apps
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.core.management.base import BaseCommand
from django.db import models

from apps.common.storage import PrivateFileSystemStorage


def file_fields():
    for model in apps.get_models():
        for field in model._meta.get_fields():
            if isinstance(field, models.FileField):
                yield model, field


def cleanup(*, dry_run=False, log=print) -> dict:
    stats = {"moved": 0, "cleared": 0, "ok": 0}
    public = FileSystemStorage(location=settings.MEDIA_ROOT)
    for model, field in file_fields():
        storage = field.storage
        is_private = isinstance(storage, PrivateFileSystemStorage)
        rows = (
            model._default_manager.exclude(**{field.name: ""}).exclude(**{f"{field.name}__isnull": True})
            .values_list("pk", field.name)
        )
        for pk, name in rows:
            if storage.exists(name):
                stats["ok"] += 1
                if is_private and public.exists(name) and not dry_run:
                    public.delete(name)  # copie publique résiduelle
                continue
            label = f"{model._meta.label}.{field.name} #{pk} — {name}"
            if is_private and public.exists(name):
                stats["moved"] += 1
                log(f"  à l'abri : {label}")
                if not dry_run:
                    with public.open(name, "rb") as content:
                        new_name = storage.save(name, content)
                    public.delete(name)
                    if new_name != name:
                        model._default_manager.filter(pk=pk).update(**{field.name: new_name})
                continue
            stats["cleared"] += 1
            log(f"  introuvable, référence vidée : {label}")
            if not dry_run:
                model._default_manager.filter(pk=pk).update(**{field.name: ""})
    return stats


class Command(BaseCommand):
    help = "Déplace les documents privés hors du dossier public et vide les références à des fichiers introuvables."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Lister sans rien modifier.")

    def handle(self, *args, dry_run=False, **options):
        stats = cleanup(dry_run=dry_run, log=self.stdout.write)
        prefix = "(simulation) " if dry_run else ""
        self.stdout.write(self.style.SUCCESS(
            f"{prefix}{stats['moved']} documents mis à l'abri, {stats['cleared']} références vidées, "
            f"{stats['ok']} fichiers en place."
        ))
