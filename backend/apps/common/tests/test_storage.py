"""Fichiers sur le serveur : documents privés par lien signé, remise en ordre."""
from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.test import Client

from apps.common.management.commands.cleanup_media import cleanup
from apps.common.storage import PrivateFileSystemStorage, read_private_token


def test_document_prive_par_lien_signe(_isolated_media):
    storage = PrivateFileSystemStorage()
    name = storage.save("payment_proofs/preuve.png", ContentFile(b"\x89PNG fake"))
    assert (_isolated_media / "private_media" / name).exists()
    assert not (_isolated_media / "media" / name).exists()  # jamais dans le dossier public

    url = storage.url(name)
    assert url.startswith("/api/v1/files/?t=")
    response = Client().get(url)
    assert response.status_code == 200 and response["Content-Type"] == "image/png"
    assert response["Cache-Control"] == "private, no-store" and "sandbox" in response["Content-Security-Policy"]

    assert Client().get(url[:-1] + ("A" if url[-1] != "A" else "B")).status_code == 404  # falsifié
    assert Client().get("/api/v1/files/").status_code == 404


def test_lien_expire(settings):
    storage = PrivateFileSystemStorage()
    url = storage.url(storage.save("cvs/cv.pdf", ContentFile(b"%PDF-1.4")))
    settings.PRIVATE_MEDIA_URL_MAX_AGE = -1
    assert Client().get(url).status_code == 404
    with pytest.raises(ValueError):
        read_private_token(url.split("t=")[1])


def test_pas_de_sortie_du_dossier_prive():
    token = signing.dumps("../../etc/passwd", salt="dah-private-media")
    assert Client().get(f"/api/v1/files/?t={token}").status_code == 404


def test_envoi_par_nginx(settings):
    settings.PRIVATE_MEDIA_ACCEL_REDIRECT = "/protected/"
    storage = PrivateFileSystemStorage()
    name = storage.save("cvs/cv.pdf", ContentFile(b"%PDF-1.4"))
    response = Client().get(storage.url(name))
    assert response["X-Accel-Redirect"] == f"/protected/{name}"
    assert "Content-Security-Policy" not in response  # lecteur PDF du navigateur


@pytest.fixture
def member(db):
    return get_user_model().objects.create_user(email="m@dah.test", password="x", first_name="M", last_name="", role="membre")


@pytest.mark.django_db
def test_preuve_de_paiement_rangee_a_l_abri(_isolated_media, member):
    from apps.payments.models import PaymentDeclaration
    declaration = PaymentDeclaration.objects.create(
        user=member, period_start=date(2026, 10, 1), months=1, monthly_rate=500, amount=500, method="cash",
        proof=ContentFile(b"img", name="preuve.png"),
    )
    assert (_isolated_media / "private_media" / declaration.proof.name).exists()
    assert declaration.proof.url.startswith("/api/v1/files/?t=")


@pytest.mark.django_db
def test_remise_en_ordre(_isolated_media, member):
    from apps.payments.models import PaymentDeclaration
    public = FileSystemStorage(location=_isolated_media / "media")
    public.save("payment_proofs/ancienne.png", ContentFile(b"img"))   # ancien emplacement public
    member.avatar = "avatars/disparu.png"                             # fichier abandonné (Cloudinary)
    member.save(update_fields=["avatar"])
    PaymentDeclaration.objects.bulk_create([PaymentDeclaration(
        user=member, period_start=date(2026, 9, 1), months=1, monthly_rate=500, amount=500, method="cash",
        proof="payment_proofs/ancienne.png",
    )])

    stats = cleanup(log=lambda *_: None)
    assert stats["moved"] == 1 and stats["cleared"] == 1
    assert (_isolated_media / "private_media" / "payment_proofs" / "ancienne.png").exists()
    assert not public.exists("payment_proofs/ancienne.png")
    member.refresh_from_db()
    assert not member.avatar
    assert cleanup(log=lambda *_: None) == {"moved": 0, "cleared": 0, "ok": 1}  # relançable


def test_choix_du_stockage(settings):
    from cloudinary_storage.storage import MediaCloudinaryStorage, RawMediaCloudinaryStorage
    from apps.common.storage import private_image_storage, private_storage
    settings.MEDIA_STORAGE = "local"
    assert isinstance(private_storage(), PrivateFileSystemStorage)
    assert isinstance(private_image_storage(), PrivateFileSystemStorage)
    settings.MEDIA_STORAGE = "cloudinary"  # pré-production (Render)
    assert isinstance(private_storage(), RawMediaCloudinaryStorage)
    assert isinstance(private_image_storage(), MediaCloudinaryStorage)


def test_remise_en_ordre_refusee_hors_stockage_local(settings):
    from django.core.management import CommandError, call_command
    settings.MEDIA_STORAGE = "cloudinary"
    with pytest.raises(CommandError):
        call_command("cleanup_media", "--dry-run")
